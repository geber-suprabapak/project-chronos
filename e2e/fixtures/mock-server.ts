import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { parse as parseUrl } from "node:url";
import {
  createInitialMockData,
  type MockAttendance,
  type MockLeaveRequest,
  type MockLocation,
} from "./data.ts";

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

interface ParsedRequestBody {
  user_id?: string;
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
}

export class MockAstraLogtoServer {
  private astraServer: http.Server | null = null;
  private logtoServer: http.Server | null = null;
  public data = createInitialMockData();

  private astraPort: number;
  private logtoPort: number;

  constructor(astraPort = 23000, logtoPort = 23001) {
    this.astraPort = astraPort;
    this.logtoPort = logtoPort;
  }

  public resetData() {
    this.data = createInitialMockData();
  }

  private sendAstraJson(
    res: ServerResponse,
    statusCode: number,
    data: unknown,
    message = "OK",
  ) {
    const envelope = {
      success: statusCode >= 200 && statusCode < 300,
      message,
      data,
      meta: {
        request_id: `mock-req-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    };
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

    // 4. MOBILE PROFILE
    if (pathname === "/v1/mobile/profile" && method === "GET") {
      const profile = this.data.students[0];
      this.sendAstraJson(res, 200, profile);
      return;
    }

    // 5. ATTENDANCES
    if (
      (pathname === "/v1/admin/attendance" ||
        pathname === "/v1/admin/attendances") &&
      method === "GET"
    ) {
      let result = [...this.data.attendances];
      if (query.date) {
        result = result.filter((a) => a.date === query.date);
      }
      if (query.startDate) {
        result = result.filter((a) => a.date >= String(query.startDate));
      }
      if (query.endDate) {
        result = result.filter((a) => a.date <= String(query.endDate));
      }
      if (query.status) {
        result = result.filter((a) => a.status === query.status);
      }
      if (query.userId) {
        result = result.filter((a) => a.user_id === query.userId);
      }
      this.sendAstraJson(res, 200, result);
      return;
    }

    if (pathname === "/v1/admin/attendance/manual" && method === "POST") {
      void this.parseBody(req).then((body) => {
        const userId = asString(
          body.user_id,
          "00000000-0000-0000-0000-000000000001",
        );
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
      /^\/v1\/admin\/attendance\/([^/]+)$/,
    );
    if (
      attendanceMatch &&
      method === "DELETE" &&
      attendanceMatch[1] !== "bulk"
    ) {
      const id = attendanceMatch[1];
      const index = this.data.attendances.findIndex((a) => a.id === id);
      if (index === -1) {
        this.sendAstraJson(res, 404, null, "Attendance not found");
      } else {
        const [removed] = this.data.attendances.splice(index, 1);
        this.sendAstraJson(res, 200, removed, "Attendance deleted");
      }
      return;
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
    if (pathname === "/v1/admin/locations" && method === "GET") {
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

    // Default fallback
    this.sendAstraJson(res, 200, { status: "ok" });
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
      this.sendJson(res, 200, { keys: [] });
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
        id_token: "mock-id-token",
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
