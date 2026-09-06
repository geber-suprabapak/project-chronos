import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  safeOperationalPath,
  writeOperationalEvent,
  type OperationalEvent,
} from "../src/lib/observability.ts";

describe("Milestone M3 Empirical Challenge: Structured Logging & PII Scrubbing", () => {
  describe("safeOperationalPath PII scrubbing", () => {
    it("returns undefined when path is undefined", () => {
      assert.equal(safeOperationalPath(undefined), undefined);
    });

    it("returns empty string when path is empty", () => {
      assert.equal(safeOperationalPath(""), "");
    });

    it("leaves clean operational paths unmodified", () => {
      assert.equal(safeOperationalPath("/api/health"), "/api/health");
      assert.equal(
        safeOperationalPath("/api/export/absences"),
        "/api/export/absences",
      );
      assert.equal(
        safeOperationalPath("/v1/admin/students"),
        "/v1/admin/students",
      );
    });

    it("strips sensitive query parameters (?token=secret&nis=1001)", () => {
      const sanitized = safeOperationalPath(
        "/api/export/absences?token=secret&nis=1001",
      );
      assert.equal(sanitized, "/api/export/absences");
      assert.doesNotMatch(sanitized!, /secret/);
      assert.doesNotMatch(sanitized!, /1001/);
      assert.doesNotMatch(sanitized!, /\?/);
    });

    it("strips URL fragment hashes (#fragment)", () => {
      const sanitized = safeOperationalPath(
        "/api/export/siswa#section-students",
      );
      assert.equal(sanitized, "/api/export/siswa");
      assert.doesNotMatch(sanitized!, /section-students/);
      assert.doesNotMatch(sanitized!, /#/);
    });

    it("strips sensitive query parameters AND fragment hash combined (?token=secret&nis=1001#fragment)", () => {
      const sanitized = safeOperationalPath(
        "/api/export/absences?token=secret&nis=1001#fragment",
      );
      assert.equal(sanitized, "/api/export/absences");
      assert.doesNotMatch(sanitized!, /token/);
      assert.doesNotMatch(sanitized!, /secret/);
      assert.doesNotMatch(sanitized!, /nis/);
      assert.doesNotMatch(sanitized!, /1001/);
      assert.doesNotMatch(sanitized!, /fragment/);
    });

    it("strips fragment before query if malformed (#fragment?token=secret)", () => {
      const sanitized = safeOperationalPath(
        "/api/export/perizinan#fragment?token=secret&nis=1001",
      );
      assert.equal(sanitized, "/api/export/perizinan");
      assert.doesNotMatch(sanitized!, /secret/);
      assert.doesNotMatch(sanitized!, /fragment/);
    });

    it("strips sensitive queries from absolute URLs with origin", () => {
      const sanitized = safeOperationalPath(
        "https://chronos.skanida.sch.id/api/export/backup?apiKey=super-secret-key-12345#audit",
      );
      assert.equal(
        sanitized,
        "https://chronos.skanida.sch.id/api/export/backup",
      );
      assert.doesNotMatch(sanitized!, /super-secret/);
      assert.doesNotMatch(sanitized!, /audit/);
    });

    it("strips URL-encoded characters and edge cases safely", () => {
      assert.equal(
        safeOperationalPath("/api/astra/files?bearer=%20secret%20#hash"),
        "/api/astra/files",
      );
      assert.equal(safeOperationalPath("/api/test?"), "/api/test");
      assert.equal(safeOperationalPath("/api/test#"), "/api/test");
      assert.equal(safeOperationalPath("/api/test?#"), "/api/test");
    });
  });

  describe("writeOperationalEvent structured emission & scrubbing", () => {
    function captureLogs<T>(fn: () => T): {
      result: T;
      infoLogs: string[];
      errorLogs: string[];
    } {
      const originalInfo = console.info;
      const originalError = console.error;
      const infoLogs: string[] = [];
      const errorLogs: string[] = [];

      console.info = (...args: unknown[]) => {
        infoLogs.push(args.map(String).join(" "));
      };
      console.error = (...args: unknown[]) => {
        errorLogs.push(args.map(String).join(" "));
      };

      try {
        const result = fn();
        return { result, infoLogs, errorLogs };
      } finally {
        console.info = originalInfo;
        console.error = originalError;
      }
    }

    it("emits failure event to console.error as valid JSON with scrubbed path", () => {
      const sensitivePath =
        "/api/export/absences?token=secret&nis=1001#fragment";
      const { infoLogs, errorLogs } = captureLogs(() => {
        writeOperationalEvent({
          event: "export.failure",
          outcome: "failure",
          requestId: "req-fail-001",
          path: sensitivePath,
          status: 500,
          error: "Simulated export failure for student data",
        });
      });

      assert.equal(infoLogs.length, 0, "Should not emit to console.info");
      assert.equal(
        errorLogs.length,
        1,
        "Should emit exactly once to console.error",
      );

      const rawJson = errorLogs[0]!;
      // Crucial empirical check: raw JSON string MUST NOT contain any sensitive query parameters or fragments
      assert.doesNotMatch(rawJson, /token=secret/);
      assert.doesNotMatch(rawJson, /nis=1001/);
      assert.doesNotMatch(rawJson, /#fragment/);

      const parsed = JSON.parse(rawJson);
      assert.equal(parsed.event, "export.failure");
      assert.equal(parsed.outcome, "failure");
      assert.equal(parsed.requestId, "req-fail-001");
      assert.equal(parsed.path, "/api/export/absences");
      assert.equal(parsed.status, 500);
      assert.equal(parsed.error, "Simulated export failure for student data");
      assert.ok(
        typeof parsed.timestamp === "string",
        "timestamp must be a string",
      );
      assert.ok(
        !isNaN(Date.parse(parsed.timestamp)),
        "timestamp must be valid ISO date",
      );
    });

    it("emits success event to console.info as valid JSON with scrubbed path", () => {
      const sensitivePath =
        "/api/export/siswa?auth_token=jwt_sensitive_signature_value#data";
      const { infoLogs, errorLogs } = captureLogs(() => {
        writeOperationalEvent({
          event: "export.access",
          outcome: "success",
          requestId: "req-success-002",
          path: sensitivePath,
          status: 200,
        });
      });

      assert.equal(errorLogs.length, 0, "Should not emit to console.error");
      assert.equal(
        infoLogs.length,
        1,
        "Should emit exactly once to console.info",
      );

      const rawJson = infoLogs[0]!;
      assert.doesNotMatch(rawJson, /jwt_sensitive/);
      assert.doesNotMatch(rawJson, /#data/);

      const parsed = JSON.parse(rawJson);
      assert.equal(parsed.event, "export.access");
      assert.equal(parsed.outcome, "success");
      assert.equal(parsed.requestId, "req-success-002");
      assert.equal(parsed.path, "/api/export/siswa");
      assert.equal(parsed.status, 200);
    });

    it("safely handles undefined path in writeOperationalEvent", () => {
      const { infoLogs, errorLogs } = captureLogs(() => {
        writeOperationalEvent({
          event: "auth.failure",
          outcome: "failure",
          requestId: "req-auth-fail",
          status: 401,
          code: "UNAUTHORIZED",
        });
      });

      assert.equal(errorLogs.length, 1);
      const parsed = JSON.parse(errorLogs[0]!);
      assert.equal(parsed.event, "auth.failure");
      assert.equal(parsed.outcome, "failure");
      assert.equal(parsed.requestId, "req-auth-fail");
      assert.equal(parsed.status, 401);
      assert.equal(parsed.path, undefined);
    });

    it("verifies all canonical OperationalEvent event types format correctly", () => {
      const events: Array<OperationalEvent["event"]> = [
        "astra.request",
        "auth.failure",
        "export.access",
        "export.failure",
        "trpc.error",
        "upload.error",
        "http.request",
      ];

      for (const eventName of events) {
        const { infoLogs, errorLogs } = captureLogs(() => {
          writeOperationalEvent({
            event: eventName,
            outcome: "failure",
            requestId: `req-${eventName}`,
            path: `/test/${eventName}?sensitive=1#frag`,
            status: 500,
          });
        });

        assert.equal(errorLogs.length, 1);
        const parsed = JSON.parse(errorLogs[0]!);
        assert.equal(parsed.event, eventName);
        assert.equal(parsed.path, `/test/${eventName}`);
        assert.doesNotMatch(errorLogs[0]!, /sensitive/);
        assert.doesNotMatch(errorLogs[0]!, /#frag/);
      }
    });
  });
});
