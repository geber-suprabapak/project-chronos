import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

// Dynamic test context state for Logto mock
let currentRole = "platform_admin";
let isAuthenticated = true;
let isPasswordChangeReq = false;

const bunTest = (globalThis as unknown as { Bun?: unknown }).Bun
  ? ((await import(
      // @ts-expect-error dynamic import under bun
      "bun:test"
    )) as {
      mock: {
        module: (
          moduleName: string,
          factory: () => Record<string, unknown>,
        ) => void;
      };
    })
  : null;

if (bunTest) {
  bunTest.mock.module("@logto/next/server-actions", () => ({
    getAccessToken: async () => "mock-bearer-token-m3-empirical",
    getAccessTokenRSC: async () => "mock-bearer-token-m3-empirical",
    getLogtoContext: async () => {
      if (!isAuthenticated) {
        return { isAuthenticated: false, claims: null };
      }
      return {
        isAuthenticated: true,
        claims: {
          sub: "user-admin-m3",
          roles: [currentRole],
          name: "Platform Admin M3",
          email: `${currentRole}@skanida.sch.id`,
          must_change_password: isPasswordChangeReq,
        },
        userInfo: {
          email: `${currentRole}@skanida.sch.id`,
          name: "Platform Admin M3",
        },
      };
    },
  }));
}

// Intercept console.error to capture structured JSON logs
const capturedErrorLogs: Array<Record<string, unknown>> = [];
const originalConsoleError = console.error;

function startLogCapture() {
  capturedErrorLogs.length = 0;
  console.error = (...args: unknown[]) => {
    const text = args.map(String).join(" ");
    try {
      const parsed = JSON.parse(text);
      capturedErrorLogs.push(parsed);
    } catch {
      // not JSON
    }
    originalConsoleError(...args);
  };
}

function stopLogCapture() {
  console.error = originalConsoleError;
}

let server: http.Server;
let serverPort: number;
let mockMode:
  "normal" | "astra_down" | "s3_fail" | "intent_fail" | "confirm_fail" =
  "normal";

server = http.createServer((req, res) => {
  const url = req.url ?? "";

  if (mockMode === "astra_down") {
    res.writeHead(503, {
      "Content-Type": "application/json",
      "X-Astra-Contract-Version": "v1",
      "X-Request-ID": req.headers["x-request-id"] || "err-req-503",
    });
    res.end(
      JSON.stringify({
        success: false,
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Downstream Astra gateway outage simulation",
        },
        meta: { request_id: "err-req-503" },
      }),
    );
    return;
  }

  if (url.startsWith("/v1/mobile/files/upload-intent")) {
    if (mockMode === "intent_fail") {
      res.writeHead(500, {
        "Content-Type": "application/json",
        "X-Astra-Contract-Version": "v1",
        "X-Request-ID": "intent-err-id",
      });
      res.end(
        JSON.stringify({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Intent failed" },
        }),
      );
      return;
    }

    res.writeHead(200, {
      "Content-Type": "application/json",
      "X-Astra-Contract-Version": "v1",
      "X-Request-ID": "mock-intent-req",
    });
    res.end(
      JSON.stringify({
        success: true,
        data: {
          file_id: "file-test-m3-123",
          upload_url: `http://127.0.0.1:${serverPort}/mock-s3-upload/file-test-m3-123`,
        },
      }),
    );
    return;
  }

  if (url.startsWith("/mock-s3-upload/")) {
    if (mockMode === "s3_fail") {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("S3 Internal Server Error");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }

  if (url.includes("/confirm")) {
    if (mockMode === "confirm_fail") {
      res.writeHead(502, {
        "Content-Type": "application/json",
        "X-Astra-Contract-Version": "v1",
        "X-Request-ID": "confirm-err-id",
      });
      res.end(
        JSON.stringify({
          success: false,
          error: { code: "CONFIRM_FAILED", message: "Confirm failed" },
        }),
      );
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/json",
      "X-Astra-Contract-Version": "v1",
      "X-Request-ID": "mock-confirm-req",
    });
    res.end(
      JSON.stringify({
        success: true,
        data: {
          id: "file-test-m3-123",
          object_path: "permits/file-test-m3-123.jpg",
        },
      }),
    );
    return;
  }

  // Default fallback
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

await new Promise<void>((resolve) => {
  server.listen(0, "127.0.0.1", () => {
    const addr = server.address();
    if (typeof addr === "object" && addr !== null) {
      serverPort = addr.port;
      process.env.ASTRA_API_URL = `http://127.0.0.1:${serverPort}`;
    }
    resolve();
  });
});

// Dynamically import route handlers AFTER process.env.ASTRA_API_URL is set
const { GET: getAbsences } =
  await import("../src/app/api/export/absences/route.ts");
const { GET: getBackup } =
  await import("../src/app/api/export/backup/route.ts");
const { GET: getPerizinan } =
  await import("../src/app/api/export/perizinan/route.ts");
const { GET: getSiswa } = await import("../src/app/api/export/siswa/route.ts");
const { GET: getProfiles } =
  await import("../src/app/api/export/profiles/route.ts");
const { POST: postFile } = await import("../src/app/api/astra/files/route.ts");
describe("Milestone M3 Empirical Challenge: Export & Upload Error Logging", () => {
  after(async () => {
    stopLogCapture();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("triggers export.failure structured log when /api/export/absences encounters an error", async () => {
    mockMode = "astra_down";
    startLogCapture();

    const req = new Request(
      "http://localhost:3000/api/export/absences?format=xlsx",
      {
        headers: { "X-Request-ID": "req-absences-err-01" },
      },
    );

    // @ts-expect-error NextRequest compatibility
    const res = await getAbsences(req);
    stopLogCapture();

    assert.equal(res.status, 500);

    const errorEvent = capturedErrorLogs.find(
      (log) =>
        log.event === "export.failure" && log.path === "/api/export/absences",
    );
    assert.ok(errorEvent, "Must emit export.failure structured event");
    assert.equal(errorEvent.outcome, "failure");
    assert.equal(errorEvent.status, 500);
    assert.equal(errorEvent.requestId, "req-absences-err-01");
    assert.ok(errorEvent.timestamp, "Must include timestamp");
    assert.ok(errorEvent.error, "Must include error message");
  });

  it("triggers export.failure structured log when /api/export/backup encounters an audit persistence failure", async () => {
    mockMode = "astra_down";
    startLogCapture();

    const req = new Request(
      "http://localhost:3000/api/export/backup?month=2026-09&format=xlsx",
      {
        headers: { "X-Request-ID": "req-backup-err-02" },
      },
    );

    // @ts-expect-error NextRequest compatibility
    const res = await getBackup(req);
    stopLogCapture();

    assert.equal(res.status, 502);

    const errorEvent = capturedErrorLogs.find(
      (log) =>
        log.event === "export.failure" && log.path === "/api/export/backup",
    );
    assert.ok(
      errorEvent,
      "Must emit export.failure structured event for backup",
    );
    assert.equal(errorEvent.outcome, "failure");
    assert.equal(errorEvent.status, 502);
    assert.equal(errorEvent.requestId, "req-backup-err-02");
  });

  it("triggers export.failure structured log when /api/export/perizinan encounters downstream Astra failure", async () => {
    mockMode = "astra_down";
    startLogCapture();

    const req = new Request(
      "http://localhost:3000/api/export/perizinan?format=xlsx",
      {
        headers: { "X-Request-ID": "req-perizinan-err-03" },
      },
    );

    const res = await getPerizinan(req as any);
    stopLogCapture();

    assert.equal(res.status, 502);

    const errorEvent = capturedErrorLogs.find(
      (log) =>
        log.event === "export.failure" && log.path === "/api/export/perizinan",
    );
    assert.ok(
      errorEvent,
      "Must emit export.failure structured event for perizinan",
    );
    assert.equal(errorEvent.outcome, "failure");
    assert.equal(errorEvent.status, 502);
    assert.equal(errorEvent.requestId, "req-perizinan-err-03");
  });

  it("triggers export.failure structured log when /api/export/siswa encounters downstream Astra failure", async () => {
    mockMode = "astra_down";
    startLogCapture();

    const req = new Request(
      "http://localhost:3000/api/export/siswa?format=xlsx",
      {
        headers: { "X-Request-ID": "req-siswa-err-04" },
      },
    );

    const res = await getSiswa(req as any);
    stopLogCapture();

    assert.equal(res.status, 502);

    const errorEvent = capturedErrorLogs.find(
      (log) =>
        log.event === "export.failure" && log.path === "/api/export/siswa",
    );
    assert.ok(
      errorEvent,
      "Must emit export.failure structured event for siswa",
    );
    assert.equal(errorEvent.outcome, "failure");
    assert.equal(errorEvent.status, 502);
    assert.equal(errorEvent.requestId, "req-siswa-err-04");
  });

  it("triggers export.failure structured log when /api/export/profiles encounters downstream Astra failure", async () => {
    mockMode = "astra_down";
    startLogCapture();

    const req = new Request(
      "http://localhost:3000/api/export/profiles?format=xlsx",
      {
        headers: { "X-Request-ID": "req-profiles-err-05" },
      },
    );

    const res = await getProfiles(req as any);
    stopLogCapture();

    assert.equal(res.status, 502);

    const errorEvent = capturedErrorLogs.find(
      (log) =>
        log.event === "export.failure" && log.path === "/api/export/profiles",
    );
    assert.ok(
      errorEvent,
      "Must emit export.failure structured event for profiles",
    );
    assert.equal(errorEvent.outcome, "failure");
    assert.equal(errorEvent.status, 502);
    assert.equal(errorEvent.requestId, "req-profiles-err-05");
  });

  it("triggers upload.error structured log when upload-intent fails", async () => {
    mockMode = "intent_fail";
    startLogCapture();

    const formData = new FormData();
    const blob = new Blob(["dummy file content"], { type: "image/jpeg" });
    formData.append("file", blob, "surat.jpg");

    const req = new Request("http://localhost:3000/api/astra/files", {
      method: "POST",
      headers: {
        "X-Request-ID": "req-upload-err-06",
      },
      body: formData,
    });

    const res = await postFile(req);
    stopLogCapture();

    assert.equal(res.status, 500);

    const errorEvent = capturedErrorLogs.find(
      (log) => log.event === "upload.error" && log.path === "/api/astra/files",
    );
    assert.ok(errorEvent, "Must emit upload.error structured event");
    assert.equal(errorEvent.outcome, "failure");
    assert.equal(errorEvent.status, 500);
    assert.equal(
      errorEvent.error,
      "Upload intent contract is unavailable or incompatible.",
    );
  });

  it("triggers upload.error structured log when S3 PUT fails", async () => {
    mockMode = "s3_fail";
    startLogCapture();

    const formData = new FormData();
    const blob = new Blob(["dummy file content"], { type: "image/jpeg" });
    formData.append("file", blob, "surat.jpg");

    const req = new Request("http://localhost:3000/api/astra/files", {
      method: "POST",
      headers: {
        "X-Request-ID": "req-upload-err-07",
      },
      body: formData,
    });

    const res = await postFile(req);
    stopLogCapture();

    assert.equal(res.status, 502);

    const errorEvent = capturedErrorLogs.find(
      (log) =>
        log.event === "upload.error" &&
        log.path === "/api/astra/files" &&
        log.error === "File upload failed.",
    );
    assert.ok(
      errorEvent,
      "Must emit upload.error structured event on S3 failure",
    );
    assert.equal(errorEvent.outcome, "failure");
    assert.equal(errorEvent.status, 502);
  });

  it("triggers upload.error structured log when upload confirm fails", async () => {
    mockMode = "confirm_fail";
    startLogCapture();

    const formData = new FormData();
    const blob = new Blob(["dummy file content"], { type: "image/jpeg" });
    formData.append("file", blob, "surat.jpg");

    const req = new Request("http://localhost:3000/api/astra/files", {
      method: "POST",
      headers: {
        "X-Request-ID": "req-upload-err-08",
      },
      body: formData,
    });

    const res = await postFile(req);
    stopLogCapture();

    assert.equal(res.status, 502);

    const errorEvent = capturedErrorLogs.find(
      (log) =>
        log.event === "upload.error" &&
        log.path === "/api/astra/files" &&
        log.error === "File upload contract is unavailable or incompatible.",
    );
    assert.ok(
      errorEvent,
      "Must emit upload.error structured event on confirm failure",
    );
    assert.equal(errorEvent.outcome, "failure");
    assert.equal(errorEvent.status, 502);
  });
});
