import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const TEST_ASTRA_PORT = 24201;
const TEST_LOGTO_PORT = 24202;

describe("Milestone M3 Iteration 2 Adversarial Stress Suite", () => {
  let astraServer: http.Server;
  let logtoServer: http.Server;
  let astraStatus = 200;
  let astraDelayMs = 0;
  let logtoStatus = 200;
  let logtoDelayMs = 0;

  const validAstraUrl = `http://127.0.0.1:${TEST_ASTRA_PORT}`;
  const validLogtoUrl = `http://127.0.0.1:${TEST_LOGTO_PORT}`;

  before(async () => {
    astraServer = http.createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(astraStatus, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify(
            astraStatus === 200
              ? { status: "ok", healthy: true }
              : { error: "Downstream Astra Failure" },
          ),
        );
      }, astraDelayMs);
    });

    logtoServer = http.createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(logtoStatus, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify(
            logtoStatus === 200
              ? { issuer: `${validLogtoUrl}/oidc` }
              : { error: "Downstream Logto Failure" },
          ),
        );
      }, logtoDelayMs);
    });

    await new Promise<void>((resolve) =>
      astraServer.listen(TEST_ASTRA_PORT, "127.0.0.1", () => resolve()),
    );
    await new Promise<void>((resolve) =>
      logtoServer.listen(TEST_LOGTO_PORT, "127.0.0.1", () => resolve()),
    );
  });

  after(async () => {
    await new Promise<void>((resolve) => astraServer.close(() => resolve()));
    await new Promise<void>((resolve) => logtoServer.close(() => resolve()));
  });

  // =========================================================================
  // SCENARIO 1: Malformed Base URL Challenge
  // =========================================================================
  describe("Scenario 1: Malformed Base URL Challenge", () => {
    const malformedUrls = [
      "not_a_url",
      "http://",
      ":::bad_url",
      "ftp://[invalid-ipv6",
      "http://localhost:99999",
      "ht tp://invalid spaces",
      "",
      "   ",
      "javascript:alert(1)",
      "http://-invalid.example",
      "http://127.0.0.1:badport",
    ];

    for (const badUrl of malformedUrls) {
      it(`gracefully handles malformed ASTRA_API_URL="${badUrl}" without throwing TypeError 500`, async () => {
        process.env.ASTRA_API_URL = badUrl;
        process.env.LOGTO_ENDPOINT = validLogtoUrl;
        astraStatus = 200;
        astraDelayMs = 0;
        logtoStatus = 200;
        logtoDelayMs = 0;

        const { GET } = await import("../src/app/api/health/ready/route.ts");
        const res = await GET();

        assert.equal(
          res.status,
          503,
          `Expected HTTP 503 degraded for bad ASTRA_API_URL "${badUrl}", got ${res.status}`,
        );
        const json = await res.json();
        assert.equal(json.status, "degraded");
        assert.equal(json.dependencies.astra, false);
        assert.equal(json.dependencies.logto, true);
        assert.ok(
          res.headers.get("x-chronos-version"),
          "Missing x-chronos-version header",
        );
        assert.ok(
          res.headers.get("x-chronos-revision"),
          "Missing x-chronos-revision header",
        );
      });

      it(`gracefully handles malformed LOGTO_ENDPOINT="${badUrl}" without throwing TypeError 500`, async () => {
        process.env.ASTRA_API_URL = validAstraUrl;
        process.env.LOGTO_ENDPOINT = badUrl;
        astraStatus = 200;
        astraDelayMs = 0;
        logtoStatus = 200;
        logtoDelayMs = 0;

        const { GET } = await import("../src/app/api/health/ready/route.ts");
        const res = await GET();

        assert.equal(
          res.status,
          503,
          `Expected HTTP 503 degraded for bad LOGTO_ENDPOINT "${badUrl}", got ${res.status}`,
        );
        const json = await res.json();
        assert.equal(json.status, "degraded");
        assert.equal(json.dependencies.astra, true);
        assert.equal(json.dependencies.logto, false);
        assert.ok(res.headers.get("x-chronos-version"));
        assert.ok(res.headers.get("x-chronos-revision"));
      });
    }

    it("gracefully handles BOTH ASTRA_API_URL and LOGTO_ENDPOINT malformed simultaneously", async () => {
      process.env.ASTRA_API_URL = ":::bad_url";
      process.env.LOGTO_ENDPOINT = "not_a_url";

      const { GET } = await import("../src/app/api/health/ready/route.ts");
      const res = await GET();

      assert.equal(res.status, 503);
      const json = await res.json();
      assert.deepEqual(json, {
        status: "degraded",
        dependencies: { astra: false, logto: false },
      });
      assert.ok(res.headers.get("x-chronos-version"));
      assert.ok(res.headers.get("x-chronos-revision"));
    });
  });

  // =========================================================================
  // SCENARIO 2: Downstream 503 & Timeout Stress
  // =========================================================================
  describe("Scenario 2: Downstream 503 & Timeout Stress with Recovery", () => {
    beforeEach(() => {
      process.env.ASTRA_API_URL = validAstraUrl;
      process.env.LOGTO_ENDPOINT = validLogtoUrl;
    });

    it("2.1 Astra Downstream 503 results in HTTP 503 degraded, and recovery restores HTTP 200", async () => {
      // Step 1: Simulate Astra 503 outage
      astraStatus = 503;
      astraDelayMs = 0;
      logtoStatus = 200;
      logtoDelayMs = 0;

      const { GET } = await import("../src/app/api/health/ready/route.ts");
      const degradedRes = await GET();

      assert.equal(degradedRes.status, 503);
      const degradedJson = await degradedRes.json();
      assert.deepEqual(degradedJson, {
        status: "degraded",
        dependencies: { astra: false, logto: true },
      });
      assert.ok(degradedRes.headers.get("x-chronos-version"));
      assert.ok(degradedRes.headers.get("x-chronos-revision"));

      // Step 2: Recover Astra to 200
      astraStatus = 200;
      const recoveredRes = await GET();
      assert.equal(recoveredRes.status, 200);
      const recoveredJson = await recoveredRes.json();
      assert.deepEqual(recoveredJson, {
        status: "ok",
        dependencies: { astra: true, logto: true },
      });
    });

    it("2.2 Astra Delay Timeout (>3000ms) results in bounded 503 degraded, and recovery restores HTTP 200", async () => {
      // Step 1: Simulate Astra hanging for 3800ms (> 3000ms timeout)
      astraStatus = 200;
      astraDelayMs = 3800;
      logtoStatus = 200;
      logtoDelayMs = 0;

      const startTime = Date.now();
      const { GET } = await import("../src/app/api/health/ready/route.ts");
      const timeoutRes = await GET();
      const duration = Date.now() - startTime;

      assert.equal(timeoutRes.status, 503);
      const timeoutJson = await timeoutRes.json();
      assert.deepEqual(timeoutJson, {
        status: "degraded",
        dependencies: { astra: false, logto: true },
      });
      // Verify bounded timeout around ~3000ms
      assert.ok(
        duration >= 2900 && duration <= 4200,
        `Expected timeout aborted between 2900ms and 4200ms, actual duration was ${duration}ms`,
      );

      // Step 2: Restore Astra delay to 0ms
      astraDelayMs = 0;
      const recoveredRes = await GET();
      assert.equal(recoveredRes.status, 200);
      const recoveredJson = await recoveredRes.json();
      assert.deepEqual(recoveredJson, {
        status: "ok",
        dependencies: { astra: true, logto: true },
      });
    });

    it("2.3 Logto Downstream 503 results in HTTP 503 degraded, and recovery restores HTTP 200", async () => {
      logtoStatus = 503;
      logtoDelayMs = 0;
      astraStatus = 200;
      astraDelayMs = 0;

      const { GET } = await import("../src/app/api/health/ready/route.ts");
      const degradedRes = await GET();

      assert.equal(degradedRes.status, 503);
      const degradedJson = await degradedRes.json();
      assert.deepEqual(degradedJson, {
        status: "degraded",
        dependencies: { astra: true, logto: false },
      });

      // Recover Logto
      logtoStatus = 200;
      const recoveredRes = await GET();
      assert.equal(recoveredRes.status, 200);
      const recoveredJson = await recoveredRes.json();
      assert.deepEqual(recoveredJson, {
        status: "ok",
        dependencies: { astra: true, logto: true },
      });
    });

    it("2.4 Logto Delay Timeout (>3000ms) results in bounded 503 degraded, and recovery restores HTTP 200", async () => {
      astraStatus = 200;
      astraDelayMs = 0;
      logtoStatus = 200;
      logtoDelayMs = 3800;

      const startTime = Date.now();
      const { GET } = await import("../src/app/api/health/ready/route.ts");
      const timeoutRes = await GET();
      const duration = Date.now() - startTime;

      assert.equal(timeoutRes.status, 503);
      const timeoutJson = await timeoutRes.json();
      assert.deepEqual(timeoutJson, {
        status: "degraded",
        dependencies: { astra: true, logto: false },
      });
      assert.ok(
        duration >= 2900 && duration <= 4200,
        `Expected timeout aborted between 2900ms and 4200ms, actual duration was ${duration}ms`,
      );

      // Restore Logto delay
      logtoDelayMs = 0;
      const recoveredRes = await GET();
      assert.equal(recoveredRes.status, 200);
    });

    it("2.5 Simultaneous Astra 503 and Logto Timeout results in bounded 503 degraded", async () => {
      astraStatus = 503;
      astraDelayMs = 0;
      logtoStatus = 200;
      logtoDelayMs = 3800;

      const startTime = Date.now();
      const { GET } = await import("../src/app/api/health/ready/route.ts");
      const res = await GET();
      const duration = Date.now() - startTime;

      assert.equal(res.status, 503);
      const json = await res.json();
      assert.deepEqual(json, {
        status: "degraded",
        dependencies: { astra: false, logto: false },
      });
      assert.ok(
        duration >= 2900 && duration <= 4200,
        `Expected duration ~3000ms, got ${duration}ms`,
      );

      // Restore both
      astraStatus = 200;
      logtoDelayMs = 0;
      const recoveredRes = await GET();
      assert.equal(recoveredRes.status, 200);
      const recoveredJson = await recoveredRes.json();
      assert.deepEqual(recoveredJson, {
        status: "ok",
        dependencies: { astra: true, logto: true },
      });
    });
  });
});
