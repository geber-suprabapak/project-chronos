import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import { parse as parseUrl } from "node:url";
import {
  createInitialMockData,
  type MockAttendance,
  type MockAttendanceAttempt,
  type MockLeaveRequest,
  type MockLocation,
} from "./data.ts";
import { schoolDate } from "../../src/lib/date-utils.ts";

export interface MockServerOptions {
  astraPort?: number;
  logtoPort?: number;
}

function asString(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}

function asOptionalString(val: unknown): string | null {
  return typeof val === "string" && val.length > 0 ? val : null;
}

function asNumber(val: unknown, fallback = 0): number {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") {
    const parsed = Number(val);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function asBoolean(val: unknown, fallback = false): boolean {
  if (typeof val === "boolean") return val;
  if (val === "true") return true;
  if (val === "false") return false;
  return fallback;
}

function rowField(row: unknown, name: string): unknown {
  if (row === null || typeof row !== "object" || Array.isArray(row)) {
    return undefined;
  }
  return Object.entries(row).find(([key]) => key === name)?.[1];
}

function rowText(row: unknown, name: string): string {
  const value = rowField(row, name);
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function normalizedAbsenceNumber(value: string): string {
  return value.replace(/^0+(?=\d)/, "");
}

interface ParsedRequestBody {
  failAt?: number;
  academic_period_id?: string;
  rows?: unknown;
  user_id?: string;
  attempt_id?: string;
  date?: string;
  status?: string;
  action_type?: string;
  reason?: string;
  category?: string;
  description?: string;
  approval_status?: string;
  file_id?: string;
  name?: string;
  latitude?: number | string;
  longitude?: number | string;
  radius_meters?: number | string;
  is_active?: boolean | string;
  start_time?: string;
  end_time?: string;
  start_checkout?: string;
  end_checkout?: string;
  grace_period_minutes?: number | string;
  ids?: unknown;
  year_month?: string;
  scope?: string;
  format?: string;
  start_date?: string;
  end_date?: string;
  checksum?: string;
  record_count?: number;
  byte_length?: number;
  result?: string;
  mode?: string;
  readMode?: string;
  failNext?: number;
  empty?: boolean;
  target?: string;
}

export class MockAstraLogtoServer {
  private astraServer: http.Server | null = null;
  private logtoServer: http.Server | null = null;
  public data = createInitialMockData();
  public backups: Array<Record<string, unknown>> = [];
  public rosterReports: Array<Record<string, unknown>> = [];
  public rosterStageCount = 0;
  public rosterAcceptCount = 0;
  public scheduleWriteFailAt = 0;
  public scheduleWriteCount = 0;
  public scheduleReadFailStatus = 0;
  public scheduleReadFailRemaining = 0;
  // C01b profile-detail fail-then-recover fixture state.
  public profileDetailFailStatus = 0;
  public profileDetailFailRemaining = 0;
  public profileDetailMutations = 0;
  // C05 leave list/detail fail-then-recover fixture state.
  public leaveRequestsFailStatus = 0;
  public leaveRequestsFailRemaining = 0;
  public leaveRequestsMutations = 0;
  // C07 configuration (location) fail-then-recover fixture state.
  public locationsFailStatus = 0;
  public locationsFailRemaining = 0;
  public locationsEmpty = false;
  public locationsMutations = 0;
  // C09 Logto fail-then-recover fixture state. mode is "off" or one of
  // "401" | "403" | "503" | "malformed" | "network"; target is "discovery" or
  // "token"; failNext counts how many subsequent requests to the target fail
  // before the fixture recovers.
  public logtoFailMode = "off";
  public logtoFailTarget = "any";
  public logtoFailRemaining = 0;

  private astraPort: number;
  private logtoPort: number;
  // RS256 signing material for mock OIDC id tokens. The Logto SDK verifies
  // the id token against the discovery JWKS, so the fixture issues a real
  // signed JWT instead of a static placeholder string.
  private readonly signPrivateKey: KeyObject;
  private readonly signPublicKey: KeyObject;
  private readonly signKeyId = "mock-logto-key-1";

  constructor(astraPort = 23000, logtoPort = 23001) {
    this.astraPort = astraPort;
    this.logtoPort = logtoPort;
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    this.signPrivateKey = privateKey;
    this.signPublicKey = publicKey;
  }

  /**
   * Signs a mock OIDC id token (RS256). Claims match what the Chronos
   * identity seam consumes: `iss` equals the discovery issuer, `aud` the
   * fixture app id, and `roles` drives the privileged-role resolution.
   */
  private signIdToken(claims: {
    sub: string;
    name: string;
    email: string;
    roles: string[];
    must_change_password?: boolean;
  }): string {
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT", kid: this.signKeyId }),
    ).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        iss: `http://127.0.0.1:${this.logtoPort}/oidc`,
        aud: "chronos-app",
        iat: now,
        exp: now + 86400 * 7,
        ...claims,
      }),
    ).toString("base64url");
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${payload}`);
    const signature = signer.sign(this.signPrivateKey).toString("base64url");
    return `${header}.${payload}.${signature}`;
  }

  private jwksDocument(): { keys: Array<JsonWebKey & { kid?: string }> } {
    // A JWKS must contain public keys only: export the paired public key so
    // jose's remote JWKS consumer accepts it, and stamp fixture metadata.
    const jwk = this.signPublicKey.export({ format: "jwk" });
    return {
      keys: [
        {
          ...jwk,
          kid: this.signKeyId,
          use: "sig",
          alg: "RS256",
        },
      ],
    };
  }

  public resetData() {
    this.data = createInitialMockData();
    this.backups = [];
    this.rosterReports = [];
    this.rosterStageCount = 0;
    this.rosterAcceptCount = 0;
    this.scheduleWriteFailAt = 0;
    this.scheduleWriteCount = 0;
    this.scheduleReadFailStatus = 0;
    this.scheduleReadFailRemaining = 0;
    this.profileDetailFailStatus = 0;
    this.profileDetailFailRemaining = 0;
    this.profileDetailMutations = 0;
    this.leaveRequestsFailStatus = 0;
    this.leaveRequestsFailRemaining = 0;
    this.leaveRequestsMutations = 0;
    this.locationsFailStatus = 0;
    this.locationsFailRemaining = 0;
    this.locationsEmpty = false;
    this.locationsMutations = 0;
    this.logtoFailMode = "off";
    this.logtoFailTarget = "any";
    this.logtoFailRemaining = 0;
  }

  private sendAstraJson(
    res: ServerResponse,
    statusCode: number,
    data: unknown,
    message = "OK",
    additionalMeta: Record<string, unknown> = {},
  ) {
    const isSuccess = statusCode >= 200 && statusCode < 300;
    const envelope: Record<string, unknown> = {
      success: isSuccess,
      message,
      data,
      meta: {
        ...additionalMeta,
        request_id: `mock-req-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    };
    if (!isSuccess) {
      envelope.error = {
        code: statusCode === 404 ? "RESOURCE_NOT_FOUND" : "INTERNAL_ERROR",
        message,
      };
    }
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "X-Astra-Contract-Version": "v1",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    });
    res.end(JSON.stringify(envelope));
  }

  private sendJson(res: ServerResponse, statusCode: number, data: unknown) {
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    });
    res.end(JSON.stringify(data));
  }

  private async parseBody(req: IncomingMessage): Promise<ParsedRequestBody> {
    return new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed && typeof parsed === "object") {
            resolve(parsed);
            return;
          }
          resolve({});
        } catch {
          resolve({});
        }
      });
    });
  }

  private handleAstraRequest(req: IncomingMessage, res: ServerResponse) {
    const parsed = parseUrl(req.url ?? "/", true);
    const pathname = parsed.pathname ?? "/";
    const method = (req.method ?? "GET").toUpperCase();
    const query = parsed.query;

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "X-Astra-Contract-Version": "v1",
      });
      res.end();
      return;
    }

    // C01b fail-then-recover controls for the profile detail boundary.
    if (pathname === "/__control/profile-detail" && method === "POST") {
      void this.parseBody(req).then((body) => {
        const mode = asString(body.mode, "off");
        const status = mode === "off" ? 0 : Number(mode);
        this.profileDetailFailStatus = Number.isFinite(status) ? status : 0;
        this.profileDetailFailRemaining = Math.max(
          Number(body.failNext ?? 0),
          0,
        );
        this.sendJson(res, 200, {
          failStatus: this.profileDetailFailStatus,
          failRemaining: this.profileDetailFailRemaining,
        });
      });
      return;
    }

    if (pathname === "/__control/profile-detail" && method === "GET") {
      this.sendJson(res, 200, {
        failStatus: this.profileDetailFailStatus,
        failRemaining: this.profileDetailFailRemaining,
        mutations: this.profileDetailMutations,
      });
      return;
    }

    // C05 fail-then-recover controls for the Leave list/detail boundary.
    // Arming a new scenario also resets the mutation counter so assertions
    // measure only the requests made by the scenario being armed.
    if (pathname === "/__control/leave-requests" && method === "POST") {
      void this.parseBody(req).then((body) => {
        const mode = asString(body.mode, "off");
        const status = mode === "off" ? 0 : Number(mode);
        this.leaveRequestsFailStatus = Number.isFinite(status) ? status : 0;
        this.leaveRequestsFailRemaining = Math.max(
          Number(body.failNext ?? 0),
          0,
        );
        this.leaveRequestsMutations = 0;
        this.sendJson(res, 200, {
          failStatus: this.leaveRequestsFailStatus,
          failRemaining: this.leaveRequestsFailRemaining,
        });
      });
      return;
    }

    if (pathname === "/__control/leave-requests" && method === "GET") {
      this.sendJson(res, 200, {
        failStatus: this.leaveRequestsFailStatus,
        failRemaining: this.leaveRequestsFailRemaining,
        mutations: this.leaveRequestsMutations,
      });
      return;
    }

    // C07 fail-then-recover controls for the configuration location boundary.
    // mode is "off" or an HTTP status string ("403" | "500" | "503" | "504");
    // failNext is how many subsequent location reads fail before the fixture
    // recovers. empty=true models a genuine first-use/no-config collection
    // without touching the stored fixture locations. Arming a new scenario
    // also resets the mutation counter.
    if (pathname === "/__control/locations" && method === "POST") {
      void this.parseBody(req).then((body) => {
        const mode = asString(body.mode, "off");
        const status = mode === "off" ? 0 : Number(mode);
        this.locationsFailStatus = Number.isFinite(status) ? status : 0;
        this.locationsFailRemaining = Math.max(Number(body.failNext ?? 0), 0);
        this.locationsEmpty = asBoolean(body.empty, false);
        this.locationsMutations = 0;
        this.sendJson(res, 200, {
          failStatus: this.locationsFailStatus,
          failRemaining: this.locationsFailRemaining,
          empty: this.locationsEmpty,
        });
      });
      return;
    }

    if (pathname === "/__control/locations" && method === "GET") {
      this.sendJson(res, 200, {
        failStatus: this.locationsFailStatus,
        failRemaining: this.locationsFailRemaining,
        empty: this.locationsEmpty,
        mutations: this.locationsMutations,
      });
      return;
    }

    const isLeaveCollectionPath = pathname.startsWith(
      "/v1/admin/leave-requests",
    );
    if (isLeaveCollectionPath && method !== "GET") {
      // Recovery invariant: retrying the Leave list/detail read must never write.
      this.leaveRequestsMutations += 1;
    }
    const isLeaveReadPath =
      isLeaveCollectionPath &&
      method === "GET" &&
      (pathname === "/v1/admin/leave-requests" ||
        /^\/v1\/admin\/leave-requests\/[^/]+$/.test(pathname));
    if (
      isLeaveReadPath &&
      this.leaveRequestsFailRemaining > 0 &&
      this.leaveRequestsFailStatus > 0
    ) {
      this.leaveRequestsFailRemaining -= 1;
      this.sendAstraJson(
        res,
        this.leaveRequestsFailStatus,
        null,
        `Simulated leave requests failure (${this.leaveRequestsFailStatus})`,
      );
      return;
    }

    const isProfileCollectionPath =
      pathname.startsWith("/v1/admin/students") ||
      pathname.startsWith("/v1/admin/staff");
    if (isProfileCollectionPath && method !== "GET") {
      // Recovery invariant: retrying the profile detail read must never write.
      this.profileDetailMutations += 1;
    }
    const isProfileDetailPath =
      isProfileCollectionPath &&
      method === "GET" &&
      /^\/v1\/admin\/(students|staff)\/[^/]+$/.test(pathname);
    if (
      isProfileDetailPath &&
      this.profileDetailFailRemaining > 0 &&
      this.profileDetailFailStatus > 0
    ) {
      this.profileDetailFailRemaining -= 1;
      this.sendAstraJson(
        res,
        this.profileDetailFailStatus,
        null,
        `Simulated profile detail failure (${this.profileDetailFailStatus})`,
      );
      return;
    }

    // 0. HEALTH PROBES
    if (pathname === "/ready" || pathname === "/live") {
      this.sendJson(res, 200, { status: "ok", healthy: true });
      return;
    }

    if (pathname === "/mock/roster-stats" && method === "GET") {
      this.sendJson(res, 200, {
        rosterStageCount: this.rosterStageCount,
        rosterAcceptCount: this.rosterAcceptCount,
      });
      return;
    }

    if (pathname === "/__control/schedules" && method === "POST") {
      void this.parseBody(req).then((body) => {
        if (typeof body.start_time === "string") {
          for (const schedule of this.data.schedules) {
            schedule.start_time = body.start_time;
          }
        }
        this.scheduleWriteFailAt = Number(body.failAt ?? 0);
        this.scheduleWriteCount = 0;
        const readMode = asString(body.readMode, "off");
        this.scheduleReadFailStatus = readMode === "off" ? 0 : Number(readMode);
        this.scheduleReadFailRemaining = Math.max(
          Number(body.failNext ?? 0),
          0,
        );
        this.sendJson(res, 200, { ready: true });
      });
      return;
    }

    if (pathname === "/v1/admin/academic-periods" && method === "GET") {
      this.sendAstraJson(res, 200, [
        {
          id: "period-1",
          school_id: "school-1",
          name: "2026/2027 Ganjil",
          start_date: "2026-07-01",
          end_date: "2026-12-31",
          is_active: true,
        },
      ]);
      return;
    }

    if (pathname === "/v1/admin/bootstrap/roster" && method === "POST") {
      void this.parseBody(req).then((body) => {
        const rows = Array.isArray(body.rows) ? body.rows : [];
        // ponytail: O(n²) duplicate scans; use keyed indexes if fixture payloads grow.
        const rejectedItems = rows.flatMap((row, rowIndex) => {
          const nis = rowText(row, "nis");
          const className = rowText(row, "class_name");
          const absenceNumber = normalizedAbsenceNumber(
            rowText(row, "absence_number"),
          );
          const duplicateNis =
            nis !== "" &&
            rows.some(
              (candidate, candidateIndex) =>
                candidateIndex !== rowIndex &&
                rowText(candidate, "nis") === nis,
            );
          const existingNis = this.data.students.some(
            (student) => student.nis === nis,
          );
          const duplicateAbsenceNumber =
            className !== "" &&
            absenceNumber !== "" &&
            rows.some(
              (candidate, candidateIndex) =>
                candidateIndex !== rowIndex &&
                rowText(candidate, "class_name") === className &&
                normalizedAbsenceNumber(
                  rowText(candidate, "absence_number"),
                ) === absenceNumber,
            );
          const usedAbsenceNumber = this.data.students.some(
            (student) =>
              student.class_name === className &&
              normalizedAbsenceNumber(student.absence_number) === absenceNumber,
          );
          const reason = duplicateNis
            ? `Duplicate NIS "${nis}" in roster batch.`
            : existingNis
              ? `NIS "${nis}" already exists in student profiles.`
              : duplicateAbsenceNumber
                ? `Absence Number "${absenceNumber}" is duplicated in class.`
                : usedAbsenceNumber
                  ? `Absence Number "${absenceNumber}" is already used in class.`
                  : className === "Unknown class"
                    ? `Invalid class reference: "${className}" is not a recognized class.`
                    : null;
          return reason ? [{ row_index: rowIndex, reason }] : [];
        });
        const report = {
          id: `roster-report-${this.rosterReports.length + 1}`,
          academic_period_id: body.academic_period_id ?? null,
          total_rows: rows.length,
          valid_rows: rows.length - rejectedItems.length,
          rejected_rows: rejectedItems.length,
          status: rejectedItems.length > 0 ? "rejected" : "staged",
          review_state: rejectedItems.length > 0 ? "rejected" : "pending",
          rows,
          rejected_items: rejectedItems,
          accepted_at: null,
          accepted_by: null,
        };
        this.rosterStageCount += 1;
        this.rosterReports.push(report);
        this.sendAstraJson(res, 201, report, "Roster staged and validated.");
      });
      return;
    }

    const rosterReportMatch = pathname.match(
      /^\/v1\/admin\/bootstrap\/roster\/([^/]+)$/,
    );
    if (rosterReportMatch && method === "GET") {
      const report = this.rosterReports.find(
        (candidate) =>
          candidate.id === decodeURIComponent(rosterReportMatch[1]!),
      );
      this.sendAstraJson(
        res,
        report ? 200 : 404,
        report ?? null,
        report ? "Roster report retrieved." : "Roster report not found",
      );
      return;
    }

    const rosterAcceptMatch = pathname.match(
      /^\/v1\/admin\/bootstrap\/roster\/([^/]+)\/accept$/,
    );
    if (rosterAcceptMatch && method === "POST") {
      const report = this.rosterReports.find(
        (candidate) =>
          candidate.id === decodeURIComponent(rosterAcceptMatch[1]!),
      );
      if (!report) {
        this.sendAstraJson(res, 404, null, "Roster report not found");
      } else {
        report.status = "accepted";
        report.review_state = "accepted";
        report.accepted_at = new Date().toISOString();
        report.accepted_by = "school-admin";
        this.rosterAcceptCount += 1;
        this.sendAstraJson(res, 200, report, "Roster report accepted.");
      }
      return;
    }

    // 1. STUDENTS
    if (pathname === "/v1/admin/students" && method === "GET") {
      let result = [...this.data.students];
      if (query.nis) {
        result = result.filter((s) => s.nis === query.nis);
      }
      if (query.nama) {
        const q = String(query.nama).toLowerCase();
        result = result.filter(
          (s) => s.full_name.toLowerCase().includes(q) || s.nis.includes(q),
        );
      }
      if (query.kelas && query.kelas !== "ALL") {
        const q = String(query.kelas).toLowerCase();
        result = result.filter((s) => s.class_name.toLowerCase().includes(q));
      }
      if (query.kelamin) {
        result = result.filter((s) => s.gender === query.kelamin);
      }
      if (query.activated !== undefined) {
        const isAct = query.activated === "true";
        result = result.filter(
          (s) => (s.lifecycle_status === "approved") === isAct,
        );
      }
      this.sendAstraJson(res, 200, result);
      return;
    }

    const studentMatch = pathname.match(/^\/v1\/admin\/students\/([^/]+)$/);
    if (studentMatch && method === "GET") {
      const id = studentMatch[1];
      const student = this.data.students.find(
        (s) => s.user_id === id || s.nis === id,
      );
      if (student) {
        this.sendAstraJson(res, 200, student);
      } else {
        this.sendAstraJson(res, 404, null, "Student not found");
      }
      return;
    }

    // 2. STAFF
    if (pathname === "/v1/admin/staff" && method === "GET") {
      this.sendAstraJson(res, 200, this.data.staff);
      return;
    }

    const staffMatch = pathname.match(/^\/v1\/admin\/staff\/([^/]+)$/);
    if (staffMatch && method === "GET") {
      const id = staffMatch[1];
      const staffMember = this.data.staff.find((s) => s.user_id === id);
      if (staffMember) {
        this.sendAstraJson(res, 200, staffMember);
      } else {
        this.sendAstraJson(res, 404, null, "Staff not found");
      }
      return;
    }

    // 3. CLASSES
    if (pathname === "/v1/admin/classes" && method === "GET") {
      this.sendAstraJson(res, 200, this.data.classes);
      return;
    }

    if (pathname === "/v1/admin/enrollments" && method === "GET") {
      this.sendAstraJson(res, 200, this.data.enrollments);
      return;
    }

    if (pathname === "/v1/admin/calendar-exceptions" && method === "GET") {
      this.sendAstraJson(res, 200, this.data.calendarExceptions);
      return;
    }

    // 4. MOBILE PROFILE
    if (pathname === "/v1/mobile/profile" && method === "GET") {
      const profile = this.data.students[0];
      this.sendAstraJson(res, 200, profile);
      return;
    }

    // 5. ATTENDANCES
    if (pathname === "/v1/admin/attendance/attempts" && method === "GET") {
      let result = [...this.data.attendanceAttempts];
      if (query.user_id || query.userId) {
        const userId = String(query.user_id ?? query.userId);
        result = result.filter((attempt) => attempt.user_id === userId);
      }
      if (query.action_type || query.actionType) {
        const actionType = String(query.action_type ?? query.actionType);
        result = result.filter((attempt) => attempt.action_type === actionType);
      }
      if (query.status) {
        result = result.filter((attempt) => attempt.status === query.status);
      }
      const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 100);
      this.sendAstraJson(res, 200, result.slice(0, limit));
      return;
    }

    const isCompleteAttendanceCollection =
      pathname === "/v1/admin/attendance/export" ||
      pathname === "/v1/admin/attendances/export";
    if (
      (isCompleteAttendanceCollection ||
        pathname === "/v1/admin/attendance" ||
        pathname === "/v1/admin/attendances") &&
      method === "GET"
    ) {
      let result = [...this.data.attendances];
      if (query.date) {
        result = result.filter((a) => a.date === query.date);
      }
      const sDate = query.start_date ?? query.startDate;
      if (sDate) {
        result = result.filter((a) => a.date >= String(sDate));
      }
      const eDate = query.end_date ?? query.endDate;
      if (eDate) {
        result = result.filter((a) => a.date <= String(eDate));
      }
      if (query.status) {
        result = result.filter((a) => a.status === query.status);
      }
      const actionType = query.action_type ?? query.actionType;
      if (actionType) {
        result = result.filter((a) => a.action_type === actionType);
      }
      if (query.userId) {
        result = result.filter((a) => a.user_id === query.userId);
      }
      if (query.user_id) {
        result = result.filter((a) => a.user_id === query.user_id);
      }
      if (isCompleteAttendanceCollection) {
        this.sendAstraJson(
          res,
          200,
          result,
          "Complete attendances collection retrieved successfully.",
          {
            pagination: { limit: result.length, offset: 0, has_more: false },
          },
        );
        return;
      }

      const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 100);
      const offset = Math.max(Number(query.offset ?? 0), 0);
      const page = result.slice(offset, offset + limit);
      this.sendAstraJson(res, 200, page, "OK", {
        pagination: {
          limit,
          offset,
          has_more: offset + page.length < result.length,
        },
      });
      return;
    }

    if (pathname === "/v1/admin/attendance/manual" && method === "POST") {
      void this.parseBody(req).then((body) => {
        const userId = asString(
          body.user_id,
          "00000000-0000-0000-0000-000000000001",
        );
        const attemptId = asString(body.attempt_id);
        const reason = asString(body.reason).trim();
        const date = asString(
          body.date,
          new Date().toISOString().split("T")[0]!,
        );
        const statusRaw = asString(body.status, "Hadir");
        const status: MockAttendance["status"] =
          statusRaw === "Terlambat" ||
          statusRaw === "Pulang" ||
          statusRaw === "Alpha"
            ? statusRaw
            : "Hadir";
        const actionTypeRaw = asString(body.action_type, "check_in");
        const actionType: MockAttendance["action_type"] =
          actionTypeRaw === "check_out" ? "check_out" : "check_in";
        const attempt = this.data.attendanceAttempts.find(
          (candidate: MockAttendanceAttempt) => candidate.id === attemptId,
        );
        if (
          reason.length < 3 ||
          !attempt ||
          (attempt.status !== "failed" && attempt.status !== "error") ||
          !Number.isFinite(Date.parse(attempt.created_at)) ||
          schoolDate(new Date(attempt.created_at)) !== date ||
          attempt.user_id !== userId ||
          attempt.action_type !== actionType
        ) {
          this.sendAstraJson(
            res,
            422,
            null,
            "Valid reason and attendance attempt are required.",
          );
          return;
        }

        const newRec: MockAttendance = {
          id: `a0000000-0000-4000-8000-${String(this.data.attendances.length + 1).padStart(12, "0")}`,
          user_id: userId,
          date,
          status,
          action_type: actionType,
          latitude: -7.4503,
          longitude: 110.2241,
          created_at: new Date().toISOString(),
        };
        this.data.attendances.push(newRec);
        this.sendAstraJson(res, 201, newRec, "Manual attendance created");
      });
      return;
    }

    const attendanceMatch = pathname.match(
      /^\/v1\/admin\/attendances?\/([^/]+)$/,
    );
    if (
      attendanceMatch &&
      attendanceMatch[1] &&
      attendanceMatch[1] !== "bulk" &&
      attendanceMatch[1] !== "manual" &&
      attendanceMatch[1] !== "attempts"
    ) {
      const id = decodeURIComponent(attendanceMatch[1]);
      if (method === "GET") {
        const att = this.data.attendances.find((a) => a.id === id);
        if (att) {
          this.sendAstraJson(res, 200, att);
        } else {
          this.sendAstraJson(res, 404, null, "Attendance not found");
        }
        return;
      }
      if (method === "DELETE") {
        const index = this.data.attendances.findIndex((a) => a.id === id);
        if (index === -1) {
          this.sendAstraJson(res, 404, null, "Attendance not found");
        } else {
          const [removed] = this.data.attendances.splice(index, 1);
          this.sendAstraJson(res, 200, removed, "Attendance deleted");
        }
        return;
      }
    }

    if (pathname === "/v1/admin/attendance/bulk" && method === "DELETE") {
      void this.parseBody(req).then((body) => {
        const ids = Array.isArray(body.ids)
          ? body.ids.filter((id): id is string => typeof id === "string")
          : [];
        const selected = this.data.attendances.filter((a) =>
          ids.includes(a.id),
        );
        if (selected.length !== ids.length) {
          this.sendAstraJson(
            res,
            404,
            null,
            "One or more attendance records not found",
          );
          return;
        }
        this.data.attendances = this.data.attendances.filter(
          (attendance) => !ids.includes(attendance.id),
        );
        this.sendAstraJson(
          res,
          200,
          { deletedCount: selected.length, deletedIds: ids },
          "Attendance records deleted",
        );
      });
      return;
    }

    // 6. LEAVE REQUESTS
    if (pathname === "/v1/admin/leave-requests" && method === "GET") {
      let result = [...this.data.leaveRequests];
      if (query.approval_status) {
        result = result.filter(
          (lr) => lr.approval_status === query.approval_status,
        );
      }
      if (query.category) {
        result = result.filter((lr) => lr.category === query.category);
      }
      if (query.user_id) {
        result = result.filter((lr) => lr.user_id === query.user_id);
      }
      if (query.date) {
        result = result.filter((lr) => lr.date === query.date);
      }
      this.sendAstraJson(res, 200, result);
      return;
    }

    const leaveHistoryMatch = pathname.match(
      /^\/v1\/admin\/leave-requests\/([^/]+)\/history$/,
    );
    if (leaveHistoryMatch && method === "GET") {
      const lr = this.data.leaveRequests.find(
        (r) => r.id === leaveHistoryMatch[1],
      );
      if (!lr) {
        this.sendAstraJson(res, 404, null, "Leave request not found");
      } else {
        this.sendAstraJson(res, 200, [
          {
            action: "approve_leave_request",
            occurred_at: "2026-10-29T01:23:00.000Z",
            actor_name: "Kepala Sekolah Test",
            actor_role: "school_admin",
          },
        ]);
      }
      return;
    }

    const leaveReqMatch = pathname.match(
      /^\/v1\/admin\/leave-requests\/([^/]+)$/,
    );
    if (leaveReqMatch && method === "GET") {
      const id = leaveReqMatch[1];
      const lr = this.data.leaveRequests.find((r) => r.id === id);
      if (lr) {
        this.sendAstraJson(res, 200, lr);
      } else {
        this.sendAstraJson(res, 404, null, "Leave request not found");
      }
      return;
    }

    if (pathname === "/v1/admin/leave-requests" && method === "POST") {
      void this.parseBody(req).then((body) => {
        const student = this.data.students.find(
          (s) => s.user_id === body.user_id,
        );
        const categoryRaw = asString(body.category, "sakit");
        const category: MockLeaveRequest["category"] =
          categoryRaw === "pergi" ? "pergi" : "sakit";
        const approvalRaw = asString(body.approval_status, "approved");
        const approvalStatus: MockLeaveRequest["approval_status"] =
          approvalRaw === "rejected" || approvalRaw === "pending"
            ? approvalRaw
            : "approved";

        const newLr: MockLeaveRequest = {
          id: `b0000000-0000-4000-8000-${String(this.data.leaveRequests.length + 1).padStart(12, "0")}`,
          user_id: asString(
            body.user_id,
            "00000000-0000-0000-0000-000000000001",
          ),
          student_name: student?.full_name ?? "Student",
          student_nis: student?.nis ?? "1000",
          student_class: student?.class_name ?? "XII RPL 1",
          absence_number: student?.absence_number ?? "01",
          category,
          description: asOptionalString(body.description),
          status: true,
          date: asString(body.date, new Date().toISOString().split("T")[0]!),
          approval_status: approvalStatus,
          attachment_url: asOptionalString(body.file_id),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.data.leaveRequests.push(newLr);
        this.sendAstraJson(res, 201, newLr, "Leave request created");
      });
      return;
    }

    const approveMatch = pathname.match(
      /^\/v1\/admin\/leave-requests\/([^/]+)\/approve$/,
    );
    if (approveMatch && method === "POST") {
      const id = approveMatch[1];
      const lr = this.data.leaveRequests.find((r) => r.id === id);
      if (lr) {
        lr.approval_status = "approved";
        lr.status = true;
        lr.updated_at = new Date().toISOString();
        this.sendAstraJson(res, 200, lr, "Leave request approved");
      } else {
        this.sendAstraJson(res, 404, null, "Leave request not found");
      }
      return;
    }

    const rejectMatch = pathname.match(
      /^\/v1\/admin\/leave-requests\/([^/]+)\/reject$/,
    );
    if (rejectMatch && method === "POST") {
      const id = rejectMatch[1];
      const lr = this.data.leaveRequests.find((r) => r.id === id);
      void this.parseBody(req).then((body) => {
        if (lr) {
          lr.approval_status = "rejected";
          lr.status = false;
          lr.rejection_reason = asString(
            body.reason,
            "Ditolak oleh administrator.",
          );
          lr.rejected_at = new Date().toISOString();
          lr.updated_at = new Date().toISOString();
          this.sendAstraJson(res, 200, lr, "Leave request rejected");
        } else {
          this.sendAstraJson(res, 404, null, "Leave request not found");
        }
      });
      return;
    }

    // 7. LOCATIONS
    const isLocationCollectionPath = pathname.startsWith("/v1/admin/locations");
    if (isLocationCollectionPath && method !== "GET") {
      // Recovery invariant: retrying the configuration read must never write.
      this.locationsMutations += 1;
    }
    if (pathname === "/v1/admin/locations" && method === "GET") {
      // C07: the empty flag models a genuine first-use/no-config collection.
      if (this.locationsEmpty) {
        this.sendAstraJson(res, 200, []);
        return;
      }
      if (this.locationsFailRemaining > 0 && this.locationsFailStatus > 0) {
        this.locationsFailRemaining -= 1;
        this.sendAstraJson(
          res,
          this.locationsFailStatus,
          null,
          `Simulated locations failure (${this.locationsFailStatus})`,
        );
        return;
      }
      let locs = [...this.data.locations];
      if (query.isActive === "true") {
        locs = locs.filter((l) => l.is_active);
      }
      this.sendAstraJson(res, 200, locs);
      return;
    }

    if (pathname === "/v1/admin/locations" && method === "POST") {
      void this.parseBody(req).then((body) => {
        const nextId = String(this.data.locations.length + 1);
        const newLoc: MockLocation = {
          id: nextId,
          name: asString(body.name, "New Location"),
          latitude: asNumber(body.latitude, -7.4503),
          longitude: asNumber(body.longitude, 110.2241),
          radius_meters: asNumber(body.radius_meters, 500),
          is_active: asBoolean(body.is_active, true),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.data.locations.push(newLoc);
        this.sendAstraJson(res, 201, newLoc, "Location created");
      });
      return;
    }

    const locMatch = pathname.match(/^\/v1\/admin\/locations\/([^/]+)$/);
    if (locMatch) {
      const id = locMatch[1];
      const loc = this.data.locations.find((l) => l.id === id);

      if (method === "PUT") {
        void this.parseBody(req).then((body) => {
          if (loc) {
            if (body.name !== undefined)
              loc.name = asString(body.name, loc.name);
            if (body.latitude !== undefined)
              loc.latitude = asNumber(body.latitude, loc.latitude);
            if (body.longitude !== undefined)
              loc.longitude = asNumber(body.longitude, loc.longitude);
            if (body.radius_meters !== undefined)
              loc.radius_meters = asNumber(
                body.radius_meters,
                loc.radius_meters,
              );
            if (body.is_active !== undefined)
              loc.is_active = asBoolean(body.is_active, loc.is_active);
            loc.updated_at = new Date().toISOString();
            this.sendAstraJson(res, 200, loc, "Location updated");
          } else {
            this.sendAstraJson(res, 404, null, "Location not found");
          }
        });
        return;
      }

      if (method === "DELETE") {
        const idx = this.data.locations.findIndex((l) => l.id === id);
        if (idx !== -1) {
          const removed = this.data.locations.splice(idx, 1)[0];
          this.sendAstraJson(res, 200, removed, "Location deleted");
        } else {
          this.sendAstraJson(res, 404, null, "Location not found");
        }
        return;
      }
    }

    // 8. SCHEDULES
    if (pathname === "/v1/admin/schedules" && method === "GET") {
      if (
        this.scheduleReadFailRemaining > 0 &&
        this.scheduleReadFailStatus > 0
      ) {
        this.scheduleReadFailRemaining -= 1;
        this.sendAstraJson(
          res,
          this.scheduleReadFailStatus,
          null,
          "Simulated schedule read failure",
        );
        return;
      }
      let scheds = [...this.data.schedules];
      if (query.day_of_week) {
        scheds = scheds.filter(
          (s) =>
            s.day_of_week.toLowerCase() ===
            String(query.day_of_week).toLowerCase(),
        );
      }
      if (query.is_active === "true") {
        scheds = scheds.filter((s) => s.is_active);
      }
      this.sendAstraJson(res, 200, scheds);
      return;
    }

    const schedMatch = pathname.match(/^\/v1\/admin\/schedules\/([^/]+)$/);
    if (schedMatch && method === "PUT") {
      const id = schedMatch[1] ?? "";
      const sched = this.data.schedules.find(
        (s) => s.id === id || s.day_of_week.toLowerCase() === id.toLowerCase(),
      );
      void this.parseBody(req).then((body) => {
        this.scheduleWriteCount += 1;
        if (this.scheduleWriteCount === this.scheduleWriteFailAt) {
          this.scheduleWriteFailAt = 0;
          this.sendAstraJson(
            res,
            503,
            null,
            "Simulated schedule write failure",
          );
          return;
        }
        if (sched) {
          if (body.start_time !== undefined)
            sched.start_time = asString(body.start_time, sched.start_time);
          if (body.end_time !== undefined)
            sched.end_time = asString(body.end_time, sched.end_time);
          if (body.start_checkout !== undefined)
            sched.start_checkout = asString(
              body.start_checkout,
              sched.start_checkout,
            );
          if (body.end_checkout !== undefined)
            sched.end_checkout = asString(
              body.end_checkout,
              sched.end_checkout,
            );
          if (body.grace_period_minutes !== undefined)
            sched.grace_period_minutes = asNumber(
              body.grace_period_minutes,
              sched.grace_period_minutes,
            );
          if (body.is_active !== undefined)
            sched.is_active = asBoolean(body.is_active, sched.is_active);
          sched.updated_at = new Date().toISOString();
          this.sendAstraJson(res, 200, sched, "Schedule updated");
        } else {
          this.sendAstraJson(res, 404, null, "Schedule not found");
        }
      });
      return;
    }

    // 9. FILE UPLOAD PROXY ENDPOINTS
    if (pathname === "/v1/mobile/files/upload-intent" && method === "POST") {
      void this.parseBody(req).then(() => {
        const fileId = `file-${Date.now()}`;
        const uploadUrl = `http://127.0.0.1:${this.astraPort}/mock-s3-upload/${fileId}`;
        this.sendAstraJson(res, 200, {
          file_id: fileId,
          upload_url: uploadUrl,
        });
      });
      return;
    }

    const s3Match = pathname.match(/^\/mock-s3-upload\/([^/]+)$/);
    if (s3Match && method === "PUT") {
      req.on("data", () => {});
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
      });
      return;
    }

    const confirmMatch = pathname.match(
      /^\/v1\/mobile\/files\/([^/]+)\/confirm$/,
    );
    if (confirmMatch && method === "POST") {
      const fileId = confirmMatch[1];
      this.sendAstraJson(res, 200, {
        id: fileId,
        object_path: `permits/${fileId}.jpg`,
        download_url: `http://127.0.0.1:${this.astraPort}/files/${fileId}.jpg`,
      });
      return;
    }

    // 10. AUTH PASSWORD
    if (pathname === "/v1/auth/password" && method === "POST") {
      this.sendAstraJson(res, 200, { success: true }, "Password updated");
      return;
    }

    // 11. ADMIN BACKUPS AUDIT
    if (pathname === "/v1/admin/backups/status" && method === "GET") {
      if (
        req.headers["x-simulate-outage"] === "true" ||
        query.outage === "true"
      ) {
        this.sendAstraJson(res, 503, null, "Astra backup service outage");
        return;
      }
      const yearMonthQuery = query.year_month
        ? String(query.year_month)
        : query.month
          ? String(query.month)
          : null;
      const scopeQuery = query.scope ? String(query.scope) : "absences";

      const matching = this.backups.filter((b) => {
        // SAFETY: Internal mock backup record properties.
        const rec = b as Record<string, unknown>;
        const bYm = rec.year_month ?? rec.month;
        const bScope = rec.scope ?? "absences";
        if (yearMonthQuery && bYm !== yearMonthQuery) return false;
        if (scopeQuery && bScope !== scopeQuery) return false;
        return true;
      });

      const record =
        matching.length > 0 ? matching[matching.length - 1]! : null;
      const completed = record !== null;

      this.sendAstraJson(res, 200, {
        completed,
        record,
      });
      return;
    }

    if (pathname === "/v1/admin/backups" && method === "POST") {
      if (
        req.headers["x-simulate-failure"] === "audit_fail" ||
        query.failAudit === "true"
      ) {
        this.sendAstraJson(
          res,
          500,
          null,
          "Simulated Astra audit persistence failure",
        );
        return;
      }
      void this.parseBody(req).then((body) => {
        const yearMonth = asString(body.year_month, "2026-09");
        const scope = asString(body.scope, "absences");
        const format = asString(body.format, "xlsx");
        const startDate = asString(body.start_date, `${yearMonth}-01`);
        const endDate = asString(body.end_date, `${yearMonth}-30`);
        const checksum = asString(body.checksum, "");
        const recordCount =
          typeof body.record_count === "number" ? body.record_count : 0;
        const byteLength =
          typeof body.byte_length === "number" ? body.byte_length : 0;

        const newBackup = {
          id: `bk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          year_month: yearMonth,
          scope,
          format,
          start_date: startDate,
          end_date: endDate,
          checksum,
          record_count: recordCount,
          byte_length: byteLength,
          result: "completed",
          created_at: new Date().toISOString(),
          performed_by: "system_server",
        };
        this.backups.push(newBackup);
        this.sendAstraJson(res, 201, newBackup, "Backup audit created");
      });
      return;
    }

    if (pathname === "/v1/admin/backups" && method === "DELETE") {
      this.backups = [];
      this.sendAstraJson(res, 200, { cleared: true }, "Backups cleared");
      return;
    }

    // Default fallback - unknown owned routes fail closed
    this.sendAstraJson(
      res,
      404,
      null,
      `Route ${method} ${pathname} not found on Astra API`,
    );
  }

  private handleLogtoRequest(req: IncomingMessage, res: ServerResponse) {
    const parsed = parseUrl(req.url ?? "/", true);
    const pathname = parsed.pathname ?? "/";
    const method = (req.method ?? "GET").toUpperCase();

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      });
      res.end();
      return;
    }

    // C09 fail-then-recover control for the Logto boundary.
    if (pathname === "/__control/logto" && method === "POST") {
      void this.parseBody(req).then((body) => {
        const mode = asString(body.mode, "off");
        this.logtoFailMode = mode;
        this.logtoFailTarget = asString(body.target, "any");
        this.logtoFailRemaining = Math.max(Number(body.failNext ?? 0), 0);
        this.sendJson(res, 200, {
          mode: this.logtoFailMode,
          target: this.logtoFailTarget,
          failRemaining: this.logtoFailRemaining,
        });
      });
      return;
    }

    if (pathname === "/__control/logto" && method === "GET") {
      this.sendJson(res, 200, {
        mode: this.logtoFailMode,
        target: this.logtoFailTarget,
        failRemaining: this.logtoFailRemaining,
      });
      return;
    }

    if (
      this.logtoFailMode !== "off" &&
      this.logtoFailRemaining > 0 &&
      (this.logtoFailTarget === "any" ||
        (pathname === "/oidc/.well-known/openid-configuration" &&
          this.logtoFailTarget === "discovery") ||
        (pathname === "/oidc/token" && this.logtoFailTarget === "token"))
    ) {
      this.logtoFailRemaining -= 1;
      if (this.logtoFailMode === "network") {
        // Simulate a connection-level failure: destroy the socket so the
        // client fetch rejects instead of receiving an HTTP response.
        res.socket?.destroy();
        return;
      }
      if (this.logtoFailMode === "malformed") {
        // Simulate a malformed provider response: HTTP 200 with a non-JSON
        // body, which breaks response.json() in the Logto requester.
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("<<not-json{");
        return;
      }
      const status = Number(this.logtoFailMode);
      if (Number.isFinite(status) && status >= 400) {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            code: "mock_logto_failure",
            message: `Simulated Logto failure (${status})`,
          }),
        );
        return;
      }
    }

    if (pathname === "/oidc/.well-known/openid-configuration") {
      this.sendJson(res, 200, {
        issuer: `http://127.0.0.1:${this.logtoPort}/oidc`,
        authorization_endpoint: `http://127.0.0.1:${this.logtoPort}/oidc/auth`,
        token_endpoint: `http://127.0.0.1:${this.logtoPort}/oidc/token`,
        userinfo_endpoint: `http://127.0.0.1:${this.logtoPort}/oidc/me`,
        jwks_uri: `http://127.0.0.1:${this.logtoPort}/oidc/jwks`,
        end_session_endpoint: `http://127.0.0.1:${this.logtoPort}/oidc/session/end`,
        revocation_endpoint: `http://127.0.0.1:${this.logtoPort}/oidc/token/revocation`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["HS256", "RS256"],
        scopes_supported: [
          "openid",
          "profile",
          "email",
          "roles",
          "custom_data",
        ],
      });
      return;
    }

    if (pathname === "/oidc/jwks") {
      this.sendJson(res, 200, this.jwksDocument());
      return;
    }

    if (pathname === "/oidc/auth") {
      const redirectUri = asString(
        parsed.query.redirect_uri,
        "http://localhost:3000/api/logto/callback",
      );
      const state = asString(parsed.query.state, "");
      const code = "mock_authorization_code_12345";
      const target = `${redirectUri}?code=${code}&state=${encodeURIComponent(state)}`;
      res.writeHead(302, { Location: target });
      res.end();
      return;
    }

    if (pathname === "/oidc/token" && method === "POST") {
      this.sendJson(res, 200, {
        access_token: "mock-access-token",
        token_type: "Bearer",
        expires_in: 86400,
        refresh_token: "mock-refresh-token",
        id_token: this.signIdToken({
          sub: "10000000-0000-0000-0000-000000000001",
          name: "Platform Administrator",
          email: "admin@skanida.sch.id",
          roles: ["platform_admin"],
          must_change_password: false,
        }),
        scope: "openid profile email roles custom_data",
      });
      return;
    }

    if (pathname === "/oidc/me") {
      const authHeader = req.headers.authorization ?? "";
      const match = authHeader.match(
        /^Bearer mock-user-token\.([A-Za-z0-9_-]+)/,
      );
      if (match && match[1]) {
        try {
          const decoded = JSON.parse(
            Buffer.from(match[1], "base64url").toString("utf8"),
          );
          this.sendJson(res, 200, decoded);
          return;
        } catch {
          // fallback
        }
      }
      this.sendJson(res, 200, {
        sub: "10000000-0000-0000-0000-000000000001",
        name: "Platform Administrator",
        email: "admin@skanida.sch.id",
        roles: ["platform_admin"],
      });
      return;
    }

    if (pathname === "/oidc/session/end") {
      const postLogout = asString(
        parsed.query.post_logout_redirect_uri,
        "http://localhost:3000/login",
      );
      res.writeHead(302, { Location: postLogout });
      res.end();
      return;
    }

    if (pathname === "/oidc/token/revocation") {
      this.sendJson(res, 200, { success: true });
      return;
    }

    this.sendJson(res, 200, { status: "ok" });
  }

  public async start(): Promise<void> {
    await Promise.all([
      new Promise<void>((resolve) => {
        this.astraServer = http.createServer((req, res) => {
          this.handleAstraRequest(req, res);
        });
        this.astraServer.listen(this.astraPort, "0.0.0.0", () => {
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        this.logtoServer = http.createServer((req, res) => {
          this.handleLogtoRequest(req, res);
        });
        this.logtoServer.listen(this.logtoPort, "0.0.0.0", () => {
          resolve();
        });
      }),
    ]);
  }

  public async stop(): Promise<void> {
    await Promise.all([
      new Promise<void>((resolve) => {
        if (this.astraServer) {
          this.astraServer.close(() => resolve());
        } else {
          resolve();
        }
      }),
      new Promise<void>((resolve) => {
        if (this.logtoServer) {
          this.logtoServer.close(() => resolve());
        } else {
          resolve();
        }
      }),
    ]);
  }
}
