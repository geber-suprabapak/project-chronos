import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";

// Dynamic test ports for scenario 1 upstream mocks
const TEST_ASTRA_PORT = 24101;
const TEST_LOGTO_PORT = 24102;
const TEST_MOCK_SERVER_ASTRA_PORT = 24103;
const TEST_MOCK_SERVER_LOGTO_PORT = 24104;

const EXPECTED_SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(self)",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-dns-prefetch-control": "on",
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://cdnjs.cloudflare.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.tile.openstreetmap.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

describe("Milestone M3 Empirical Adversarial Challenge (Issues 08 & 09)", () => {
  // =========================================================================
  // SCENARIO 1: Probe Routing (/api/health/ready)
  // =========================================================================
  describe("Scenario 1: Probe Routing (/api/health/ready)", () => {
    let astraServer: http.Server;
    let logtoServer: http.Server;
    let astraStatus = 200;
    let astraDelayMs = 0;
    let logtoStatus = 200;
    let logtoDelayMs = 0;
    let lastAstraRequestPath = "";
    let lastLogtoRequestPath = "";

    before(async () => {
      process.env.ASTRA_API_URL = `http://127.0.0.1:${TEST_ASTRA_PORT}`;
      process.env.LOGTO_ENDPOINT = `http://127.0.0.1:${TEST_LOGTO_PORT}`;

      astraServer = http.createServer((req, res) => {
        lastAstraRequestPath = req.url ?? "";
        setTimeout(() => {
          res.writeHead(astraStatus, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify(
              astraStatus === 200
                ? { status: "ok", healthy: true }
                : { error: "Internal Server Error" },
            ),
          );
        }, astraDelayMs);
      });

      logtoServer = http.createServer((req, res) => {
        lastLogtoRequestPath = req.url ?? "";
        setTimeout(() => {
          res.writeHead(logtoStatus, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify(
              logtoStatus === 200
                ? { issuer: "http://127.0.0.1:24102/oidc" }
                : { error: "Logto Error" },
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

    it("1.1 Healthy: Both upstream respond 200 -> returns HTTP 200 status 'ok'", async () => {
      astraStatus = 200;
      astraDelayMs = 0;
      logtoStatus = 200;
      logtoDelayMs = 0;

      const { GET } = await import("../src/app/api/health/ready/route.ts");
      const res = await GET();

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.deepEqual(json, {
        status: "ok",
        dependencies: { astra: true, logto: true },
      });
      assert.equal(lastAstraRequestPath, "/ready", "Must query Astra /ready");
      assert.equal(
        lastLogtoRequestPath,
        "/oidc/.well-known/openid-configuration",
        "Must query Logto openid-configuration",
      );
    });

    it("1.2 Astra Outage: Upstream Astra returns 500 -> returns HTTP 503 status 'degraded'", async () => {
      astraStatus = 500;
      astraDelayMs = 0;
      logtoStatus = 200;
      logtoDelayMs = 0;

      const { GET } = await import("../src/app/api/health/ready/route.ts");
      const res = await GET();

      assert.equal(res.status, 503);
      const json = await res.json();
      assert.deepEqual(json, {
        status: "degraded",
        dependencies: { astra: false, logto: true },
      });
    });

    it("1.3 Astra Timeout: Upstream Astra hangs >3s -> aborts and returns HTTP 503 'degraded' without crashing", async () => {
      astraStatus = 200;
      astraDelayMs = 3500; // Exceeds 3000ms AbortSignal.timeout
      logtoStatus = 200;
      logtoDelayMs = 0;

      const startTime = Date.now();
      const { GET } = await import("../src/app/api/health/ready/route.ts");
      const res = await GET();
      const duration = Date.now() - startTime;

      assert.equal(res.status, 503);
      const json = await res.json();
      assert.deepEqual(json, {
        status: "degraded",
        dependencies: { astra: false, logto: true },
      });
      // Verification that timeout was bounded around ~3000ms (+/- 500ms)
      assert.ok(
        duration >= 2900 && duration <= 4000,
        `Expected ~3000ms timeout duration, got ${duration}ms`,
      );
    });

    it("1.4 Astra Connection Refused: Unreachable port -> returns HTTP 503 'degraded' without crash", async () => {
      process.env.ASTRA_API_URL = "http://127.0.0.1:24999"; // Nothing listening
      logtoStatus = 200;
      logtoDelayMs = 0;

      const { GET } = await import("../src/app/api/health/ready/route.ts");
      const res = await GET();

      assert.equal(res.status, 503);
      const json = await res.json();
      assert.deepEqual(json, {
        status: "degraded",
        dependencies: { astra: false, logto: true },
      });

      // Restore ASTRA_API_URL
      process.env.ASTRA_API_URL = `http://127.0.0.1:${TEST_ASTRA_PORT}`;
    });

    it("1.5 Logto Outage: Upstream Logto returns 500 -> returns HTTP 503 status 'degraded'", async () => {
      astraStatus = 200;
      astraDelayMs = 0;
      logtoStatus = 500;
      logtoDelayMs = 0;

      const { GET } = await import("../src/app/api/health/ready/route.ts");
      const res = await GET();

      assert.equal(res.status, 503);
      const json = await res.json();
      assert.deepEqual(json, {
        status: "degraded",
        dependencies: { astra: true, logto: false },
      });
    });

    it("1.6 Logto Timeout: Upstream Logto hangs >3s -> aborts and returns HTTP 503 'degraded'", async () => {
      astraStatus = 200;
      astraDelayMs = 0;
      logtoStatus = 200;
      logtoDelayMs = 3500; // Exceeds 3000ms AbortSignal.timeout

      const startTime = Date.now();
      const { GET } = await import("../src/app/api/health/ready/route.ts");
      const res = await GET();
      const duration = Date.now() - startTime;

      assert.equal(res.status, 503);
      const json = await res.json();
      assert.deepEqual(json, {
        status: "degraded",
        dependencies: { astra: true, logto: false },
      });
      assert.ok(
        duration >= 2900 && duration <= 4000,
        `Expected ~3000ms timeout duration, got ${duration}ms`,
      );
    });

    it("1.7 Complete Outage: Both Astra and Logto 500 -> returns HTTP 503 'degraded' with both dependencies false", async () => {
      astraStatus = 500;
      astraDelayMs = 0;
      logtoStatus = 500;
      logtoDelayMs = 0;

      const { GET } = await import("../src/app/api/health/ready/route.ts");
      const res = await GET();

      assert.equal(res.status, 503);
      const json = await res.json();
      assert.deepEqual(json, {
        status: "degraded",
        dependencies: { astra: false, logto: false },
      });
    });
  });

  // =========================================================================
  // SCENARIO 2: Liveness Probe (/api/health/live)
  // =========================================================================
  describe("Scenario 2: Liveness Probe (/api/health/live)", () => {
    it("2.1 Returns HTTP 200 { status: 'ok' } independently of upstream dependencies", async () => {
      // Intentionally point dependencies to broken non-listening hosts
      process.env.ASTRA_API_URL = "http://127.0.0.1:24991";
      process.env.LOGTO_ENDPOINT = "http://127.0.0.1:24992";

      const { GET } = await import("../src/app/api/health/live/route.ts");
      const startTime = Date.now();
      const res = await GET();
      const duration = Date.now() - startTime;

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.deepEqual(json, { status: "ok" });
      assert.ok(
        duration < 20,
        `Liveness probe took ${duration}ms (expected <20ms)`,
      );
    });

    it("2.2 Returns status ok with non-responsive upstream endpoints", async () => {
      const origAstra = process.env.ASTRA_API_URL;
      const origLogto = process.env.LOGTO_ENDPOINT;
      try {
        process.env.ASTRA_API_URL = "http://127.0.0.1:24993";
        process.env.LOGTO_ENDPOINT = "http://127.0.0.1:24994";

        const { GET } = await import("../src/app/api/health/live/route.ts");
        const res = await GET();

        assert.equal(res.status, 200);
        const json = await res.json();
        assert.deepEqual(json, { status: "ok" });
      } finally {
        process.env.ASTRA_API_URL = origAstra;
        process.env.LOGTO_ENDPOINT = origLogto;
      }
    });
  });

  // =========================================================================
  // SCENARIO 3: Mock Server (e2e/fixtures/mock-server.ts)
  // =========================================================================
  describe("Scenario 3: Mock Server Probe Endpoints", () => {
    let mockServerInstance: any;

    before(async () => {
      const { MockAstraLogtoServer } =
        await import("../e2e/fixtures/mock-server.ts");
      mockServerInstance = new MockAstraLogtoServer(
        TEST_MOCK_SERVER_ASTRA_PORT,
        TEST_MOCK_SERVER_LOGTO_PORT,
      );
      await mockServerInstance.start();
    });

    after(async () => {
      if (mockServerInstance) {
        await mockServerInstance.stop();
      }
    });

    it("3.1 Mock Astra handles GET /ready returning 200 and { status: 'ok', healthy: true }", async () => {
      const res = await fetch(
        `http://127.0.0.1:${TEST_MOCK_SERVER_ASTRA_PORT}/ready`,
      );
      assert.equal(res.status, 200);
      assert.ok(res.headers.get("content-type")?.includes("application/json"));
      const json = await res.json();
      assert.deepEqual(json, { status: "ok", healthy: true });
    });

    it("3.2 Mock Astra handles GET /live returning 200 and { status: 'ok', healthy: true }", async () => {
      const res = await fetch(
        `http://127.0.0.1:${TEST_MOCK_SERVER_ASTRA_PORT}/live`,
      );
      assert.equal(res.status, 200);
      assert.ok(res.headers.get("content-type")?.includes("application/json"));
      const json = await res.json();
      assert.deepEqual(json, { status: "ok", healthy: true });
    });

    it("3.3 Mock Astra handles OPTIONS /ready preflight with 204", async () => {
      const res = await fetch(
        `http://127.0.0.1:${TEST_MOCK_SERVER_ASTRA_PORT}/ready`,
        { method: "OPTIONS" },
      );
      assert.equal(res.status, 204);
      assert.equal(res.headers.get("access-control-allow-origin"), "*");
    });

    it("3.4 Mock Logto handles openid-configuration correctly", async () => {
      const res = await fetch(
        `http://127.0.0.1:${TEST_MOCK_SERVER_LOGTO_PORT}/oidc/.well-known/openid-configuration`,
      );
      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.ok(json.issuer.includes("/oidc"));
      assert.ok(json.jwks_uri.includes("/jwks"));
    });
  });

  // =========================================================================
  // SCENARIO 4: Security Headers Enforcement (middleware.ts & next.config.js)
  // =========================================================================
  describe("Scenario 4: Canonical Security Headers Enforcement", () => {
    function assertAllSecurityHeadersPresent(
      headers: Headers,
      contextMsg: string,
    ) {
      for (const [key, expectedValue] of Object.entries(
        EXPECTED_SECURITY_HEADERS,
      )) {
        const actualValue = headers.get(key);
        assert.ok(
          actualValue !== null && actualValue !== undefined,
          `[${contextMsg}] Missing expected security header: ${key}`,
        );
        if (key === "content-security-policy") {
          assert.ok(
            actualValue.includes("default-src 'self'"),
            `[${contextMsg}] CSP missing default-src 'self'`,
          );
          assert.ok(
            actualValue.includes("frame-ancestors 'none'"),
            `[${contextMsg}] CSP missing frame-ancestors 'none'`,
          );
          assert.ok(
            actualValue.includes("form-action 'self'"),
            `[${contextMsg}] CSP missing form-action 'self'`,
          );
          assert.ok(
            actualValue.includes("base-uri 'self'"),
            `[${contextMsg}] CSP missing base-uri 'self'`,
          );
        } else if (key === "strict-transport-security") {
          assert.ok(
            actualValue.includes("max-age=31536000"),
            `[${contextMsg}] HSTS missing max-age=31536000`,
          );
        } else {
          assert.equal(
            actualValue,
            expectedValue,
            `[${contextMsg}] Header ${key} mismatch`,
          );
        }
      }
    }

    it("4.1 Edge Redirect on Unauthenticated Protected Route (/dashboard) attaches all 7 security headers", async () => {
      const { middleware } = await import("../middleware.ts");
      const req = new NextRequest("http://localhost:3000/dashboard");
      const res = await middleware(req);

      assert.ok(res, "Middleware must return a response");
      assert.ok(
        [302, 307].includes(res.status),
        `Expected redirect status 302 or 307, got ${res.status}`,
      );
      const location = res.headers.get("Location") ?? "";
      assert.ok(
        location.includes("/login") &&
          location.includes("redirect=%2Fdashboard"),
        `Expected redirect to /login with redirect param, got: ${location}`,
      );

      assertAllSecurityHeadersPresent(
        res.headers,
        "Unauthenticated Redirect (/dashboard)",
      );
    });

    it("4.2 Edge Redirect on Protected Sub-path (/siswa?kelas=XII-RPL-1) preserves query and attaches all 7 security headers", async () => {
      const { middleware } = await import("../middleware.ts");
      const req = new NextRequest(
        "http://localhost:3000/siswa?kelas=XII-RPL-1",
      );
      const res = await middleware(req);

      assert.ok(res);
      assert.ok([302, 307].includes(res.status));
      const location = res.headers.get("Location") ?? "";
      assert.ok(
        location.includes("/login") && location.includes("redirect="),
        `Expected redirect to /login, got: ${location}`,
      );

      assertAllSecurityHeadersPresent(
        res.headers,
        "Sub-path Redirect (/siswa?kelas=XII-RPL-1)",
      );
    });

    it("4.3 Public Path (/login) NextResponse attaches all 7 security headers", async () => {
      const { middleware } = await import("../middleware.ts");
      const req = new NextRequest("http://localhost:3000/login");
      const res = await middleware(req);

      assert.ok(res);
      assert.equal(res.status, 200);

      assertAllSecurityHeadersPresent(res.headers, "Public Path (/login)");
    });

    it("4.4 API Path (/api/health/ready) NextResponse attaches all 7 security headers", async () => {
      const { middleware } = await import("../middleware.ts");
      const req = new NextRequest("http://localhost:3000/api/health/ready");
      const res = await middleware(req);

      assert.ok(res);
      assert.equal(res.status, 200);

      assertAllSecurityHeadersPresent(
        res.headers,
        "API Route (/api/health/ready)",
      );
    });

    it("4.5 Static next.config.js configuration defines all 7 security headers for /:path*", async () => {
      const nextConfigModule = await import("../next.config.js");
      const config = nextConfigModule.default;
      assert.ok(
        typeof config.headers === "function",
        "headers() must be a function",
      );

      const headerRules = await config.headers();
      assert.ok(Array.isArray(headerRules), "headers() must return an array");

      const wildCardRule = headerRules.find((r: any) => r.source === "/:path*");
      assert.ok(wildCardRule, "Must define header rule for /:path*");

      const definedHeaderKeys = new Set(
        wildCardRule.headers.map((h: any) => h.key.toLowerCase()),
      );

      for (const requiredKey of Object.keys(EXPECTED_SECURITY_HEADERS)) {
        assert.ok(
          definedHeaderKeys.has(requiredKey.toLowerCase()),
          `next.config.js missing security header: ${requiredKey}`,
        );
      }
    });
  });

  // =========================================================================
  // SCENARIO 5: Docker Compose Digest Pinning
  // =========================================================================
  describe("Scenario 5: Docker Compose Digest Pinning", () => {
    it("5.1 Fails closed with exit code 1 when CHRONOS_IMAGE_REF is unset", () => {
      let threw = false;
      let stderrOutput = "";
      try {
        execSync(
          "env -u CHRONOS_IMAGE_REF docker compose config --no-env-resolution -q",
          {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
      } catch (err: any) {
        threw = true;
        assert.equal(err.status, 1, "Expected exit code 1");
        stderrOutput = (err.stderr || err.message).toString();
      }

      assert.ok(
        threw,
        "docker compose config -q must throw when CHRONOS_IMAGE_REF is unset",
      );
      assert.ok(
        stderrOutput.includes("CHRONOS_IMAGE_REF") &&
          stderrOutput.includes(
            "Set CHRONOS_IMAGE_REF to an immutable digest-pinned image",
          ),
        `Unexpected error output: ${stderrOutput}`,
      );
    });

    it("5.2 Fails closed with exit code 1 when CHRONOS_IMAGE_REF is empty string", () => {
      let threw = false;
      let stderrOutput = "";
      try {
        execSync(
          'env CHRONOS_IMAGE_REF="" docker compose config --no-env-resolution -q',
          {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
      } catch (err: any) {
        threw = true;
        assert.equal(err.status, 1, "Expected exit code 1");
        stderrOutput = (err.stderr || err.message).toString();
      }

      assert.ok(
        threw,
        "docker compose config -q must throw when CHRONOS_IMAGE_REF is empty string",
      );
      assert.ok(
        stderrOutput.includes("CHRONOS_IMAGE_REF") &&
          stderrOutput.includes(
            "Set CHRONOS_IMAGE_REF to an immutable digest-pinned image",
          ),
        `Unexpected error output: ${stderrOutput}`,
      );
    });

    it("5.3 Succeeds with exit code 0 when valid immutable digest reference is supplied", () => {
      const validDigestRef =
        "ghcr.io/skanida/chronos@sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
      const output = execSync(
        `env CHRONOS_IMAGE_REF="${validDigestRef}" CHRONOS_ENV_FILE=.env.example docker compose config`,
        {
          encoding: "utf-8",
        },
      );

      assert.ok(
        output.includes(validDigestRef),
        "Rendered compose config must contain the pinned digest reference",
      );
      assert.ok(
        output.includes("http://localhost:3000/api/health/live"),
        "Healthcheck must target liveness probe",
      );
    });

    it("5.4 Dockerfile supports BUILD_REVISION fallback and OCI metadata labels", () => {
      const dockerfileContent = readFileSync("Dockerfile", "utf-8");

      assert.ok(
        dockerfileContent.includes("ARG BUILD_REVISION"),
        "Dockerfile must declare ARG BUILD_REVISION",
      );
      assert.ok(
        dockerfileContent.includes("ARG COMMIT_SHA"),
        "Dockerfile must declare ARG COMMIT_SHA",
      );
      assert.ok(
        dockerfileContent.includes("ENV CHRONOS_COMMIT_SHA"),
        "Dockerfile must set ENV CHRONOS_COMMIT_SHA",
      );
      assert.ok(
        dockerfileContent.includes("org.opencontainers.image.revision"),
        "Dockerfile must label org.opencontainers.image.revision",
      );
      assert.ok(
        /org\.opencontainers\.image\.title="[Cc]hronos"/.test(
          dockerfileContent,
        ),
        "Dockerfile must label org.opencontainers.image.title",
      );
    });
  });
});
