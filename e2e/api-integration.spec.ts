import { test, expect, createMockLogtoSessionCookie } from "./fixtures/auth.ts";

test.describe("Backend Integration & API Contract Verification", () => {
  test("verifies /api/health responds with status ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ status: "ok" });
  });

  test("verifies /api/health/live responds with status ok", async ({
    request,
  }) => {
    const response = await request.get("/api/health/live");
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ status: "ok" });
  });

  test("verifies /api/health/ready responds with ok and dependencies", async ({
    request,
  }) => {
    const response = await request.get("/api/health/ready");
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      status: "ok",
      dependencies: {
        astra: true,
        logto: true,
      },
    });
  });

  test.describe("/api/health/ready outage and degradation handling", () => {
    const mockAstraUrl = `http://127.0.0.1:${process.env.MOCK_ASTRA_PORT || "23500"}`;

    test.afterEach(async ({ request }) => {
      try {
        await request.post(`${mockAstraUrl}/mock/simulate-astra-outage`, {
          data: { mode: "none" },
        });
      } catch {
        // ignore if mock server is unreachable
      }
    });

    test("verifies /api/health/ready returns HTTP 503 degraded when Astra dependency fails", async ({
      request,
    }) => {
      // 1. Simulate Astra downstream outage
      const mockRes = await request.post(
        `${mockAstraUrl}/mock/simulate-astra-outage`,
        {
          data: { mode: "503" },
        },
      );
      expect(mockRes.status()).toBe(200);

      // 2. Assert degraded 503 response
      const response = await request.get("/api/health/ready");
      expect(response.status()).toBe(503);
      const json = await response.json();
      expect(json).toEqual({
        status: "degraded",
        dependencies: {
          astra: false,
          logto: true,
        },
      });

      // 3. Restore and verify recovery to 200 ok
      await request.post(`${mockAstraUrl}/mock/simulate-astra-outage`, {
        data: { mode: "none" },
      });
      const recovered = await request.get("/api/health/ready");
      expect(recovered.status()).toBe(200);
      const recoveredJson = await recovered.json();
      expect(recoveredJson).toEqual({
        status: "ok",
        dependencies: {
          astra: true,
          logto: true,
        },
      });
    });

    test("verifies /api/health/ready returns HTTP 503 degraded when Astra dependency times out (>3000ms)", async ({
      request,
    }) => {
      // 1. Simulate Astra downstream timeout (4000ms delay vs 3000ms AbortSignal.timeout)
      const mockRes = await request.post(
        `${mockAstraUrl}/mock/simulate-astra-outage`,
        {
          data: { mode: "timeout" },
        },
      );
      expect(mockRes.status()).toBe(200);

      // 2. Assert bounded abort timeout and degraded 503 response
      const startTime = Date.now();
      const response = await request.get("/api/health/ready");
      const elapsed = Date.now() - startTime;

      expect(response.status()).toBe(503);
      const json = await response.json();
      expect(json).toEqual({
        status: "degraded",
        dependencies: {
          astra: false,
          logto: true,
        },
      });
      expect(elapsed).toBeGreaterThanOrEqual(2800);
      expect(elapsed).toBeLessThan(5000);

      // 3. Restore Astra
      await request.post(`${mockAstraUrl}/mock/simulate-astra-outage`, {
        data: { mode: "none" },
      });
      const recovered = await request.get("/api/health/ready");
      expect(recovered.status()).toBe(200);
    });
  });

  test("verifies canonical security headers on responses and redirects", async ({
    request,
  }) => {
    const response = await request.get("/login");
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe(
      "camera=(), microphone=(), geolocation=(self)",
    );
    expect(headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(headers["x-dns-prefetch-control"]).toBe("on");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );

    const redirectRes = await request.get("/dashboard", {
      maxRedirects: 0,
    });
    expect([302, 307]).toContain(redirectRes.status());
    const redirectHeaders = redirectRes.headers();
    expect(redirectHeaders["x-content-type-options"]).toBe("nosniff");
    expect(redirectHeaders["x-frame-options"]).toBe("DENY");
    expect(redirectHeaders["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(redirectHeaders["strict-transport-security"]).toContain(
      "max-age=31536000",
    );
    expect(redirectHeaders["content-security-policy"]).toContain(
      "default-src 'self'",
    );
  });

  test.describe("File Upload Proxy (/api/astra/files)", () => {
    test("rejects unauthenticated file upload requests with 401", async ({
      request,
    }) => {
      const response = await request.post("/api/astra/files");
      expect(response.status()).toBe(401);
      const json = await response.json();
      expect(json.error).toBe("Unauthorized");
    });

    test("rejects authenticated file upload without file with 400", async ({
      request,
    }) => {
      const adminCookie = await createMockLogtoSessionCookie({
        roles: ["platform_admin"],
      });

      const response = await request.post("/api/astra/files", {
        headers: {
          Cookie: `logto_chronos-app=${adminCookie}`,
        },
        multipart: {
          dummy: "test",
        },
      });
      expect(response.status()).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("A file is required.");
    });

    test("rejects password-change-required account with 403", async ({
      request,
    }) => {
      const cookie = await createMockLogtoSessionCookie({
        roles: ["platform_admin"],
        must_change_password: true,
      });

      const response = await request.post("/api/astra/files", {
        headers: { Cookie: `logto_chronos-app=${cookie}` },
        multipart: {
          file: {
            name: "surat.jpg",
            mimeType: "image/jpeg",
            buffer: Buffer.from("dummy-image"),
          },
        },
      });
      expect(response.status()).toBe(403);
      const json = await response.json();
      expect(json.error).toBe("Password change required");
    });

    test("rejects student and legacy siswa roles with 403", async ({
      request,
    }) => {
      for (const role of ["student", "siswa"]) {
        const cookie = await createMockLogtoSessionCookie({ roles: [role] });
        const response = await request.post("/api/astra/files", {
          headers: { Cookie: `logto_chronos-app=${cookie}` },
          multipart: {
            file: {
              name: "surat.jpg",
              mimeType: "image/jpeg",
              buffer: Buffer.from("dummy-image"),
            },
          },
        });
        expect(response.status()).toBe(403);
        const json = await response.json();
        expect(json.error).toBe("Forbidden");
      }
    });

    test("rejects unsupported file type with 400", async ({ request }) => {
      const adminCookie = await createMockLogtoSessionCookie({
        roles: ["platform_admin"],
      });

      const response = await request.post("/api/astra/files", {
        headers: { Cookie: `logto_chronos-app=${adminCookie}` },
        multipart: {
          file: {
            name: "exploit.exe",
            mimeType: "application/x-msdownload",
            buffer: Buffer.from("executable-binary"),
          },
        },
      });
      expect(response.status()).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("Unsupported file type");
    });

    test("successfully proxies valid multipart image file upload for teacher and staff", async ({
      request,
    }) => {
      for (const role of ["teacher", "staff"]) {
        const cookie = await createMockLogtoSessionCookie({ roles: [role] });

        const dummyImageBuffer = Buffer.from(
          "fake-jpeg-binary-image-content-for-test",
        );

        const response = await request.post("/api/astra/files", {
          headers: {
            Cookie: `logto_chronos-app=${cookie}`,
            "X-Request-ID": `test-trace-${role}`,
          },
          multipart: {
            file: {
              name: "surat_dokter.jpg",
              mimeType: "image/jpeg",
              buffer: dummyImageBuffer,
            },
          },
        });

        expect(response.status()).toBe(200);
        const json = await response.json();
        expect(json.file_id).toBeDefined();
        expect(json.url).toBeDefined();
        expect(json.request_id).toBe(`test-trace-${role}`);
        expect(response.headers()["x-request-id"]).toBe(`test-trace-${role}`);
      }
    });

    test("successfully proxies valid multipart image file upload", async ({
      request,
    }) => {
      const adminCookie = await createMockLogtoSessionCookie({
        roles: ["platform_admin"],
      });

      const dummyImageBuffer = Buffer.from(
        "fake-jpeg-binary-image-content-for-test",
      );

      const response = await request.post("/api/astra/files", {
        headers: {
          Cookie: `logto_chronos-app=${adminCookie}`,
        },
        multipart: {
          file: {
            name: "surat_dokter.jpg",
            mimeType: "image/jpeg",
            buffer: dummyImageBuffer,
          },
        },
      });

      expect(response.status()).toBe(200);
      const json = await response.json();
      expect(json.file_id).toBeDefined();
      expect(json.url).toBeDefined();
    });
  });

  test.describe("RBAC Export Access Guards (/api/export/*)", () => {
    const exportRoutes = [
      "/api/export/absences",
      "/api/export/perizinan",
      "/api/export/siswa",
      "/api/export/profiles",
    ];

    for (const route of exportRoutes) {
      test(`rejects unauthenticated requests to ${route} with 401`, async ({
        request,
      }) => {
        const response = await request.get(route);
        expect(response.status()).toBe(401);
        const json = await response.json();
        expect(json.error).toBe("Unauthorized");
      });

      test(`rejects unprivileged student account from ${route} with 403`, async ({
        request,
      }) => {
        const studentCookie = await createMockLogtoSessionCookie({
          roles: ["student"],
        });
        const response = await request.get(route, {
          headers: {
            Cookie: `logto_chronos-app=${studentCookie}`,
          },
        });
        expect(response.status()).toBe(403);
        const json = await response.json();
        expect(json.error).toBe("Forbidden");
      });
    }

    test("allows teacher role to export absences, perizinan, and siswa per D1", async ({
      request,
    }) => {
      const teacherCookie = await createMockLogtoSessionCookie({
        roles: ["teacher"],
      });

      const absencesRes = await request.get("/api/export/absences", {
        headers: { Cookie: `logto_chronos-app=${teacherCookie}` },
      });
      expect(absencesRes.status()).toBe(200);
      expect(absencesRes.headers()["content-type"]).toContain("spreadsheetml");

      const perizinanRes = await request.get("/api/export/perizinan", {
        headers: { Cookie: `logto_chronos-app=${teacherCookie}` },
      });
      expect(perizinanRes.status()).toBe(200);
      expect(perizinanRes.headers()["content-type"]).toContain("spreadsheetml");

      const siswaRes = await request.get("/api/export/siswa", {
        headers: { Cookie: `logto_chronos-app=${teacherCookie}` },
      });
      expect(siswaRes.status()).toBe(200);
      expect(siswaRes.headers()["content-type"]).toContain("spreadsheetml");
    });

    test("forbids teacher role from exporting admin-only resources (profiles)", async ({
      request,
    }) => {
      const teacherCookie = await createMockLogtoSessionCookie({
        roles: ["teacher"],
      });

      const profilesRes = await request.get("/api/export/profiles", {
        headers: { Cookie: `logto_chronos-app=${teacherCookie}` },
      });
      expect(profilesRes.status()).toBe(403);
    });

    test("allows platform_admin to export all resources", async ({
      request,
    }) => {
      const adminCookie = await createMockLogtoSessionCookie({
        roles: ["platform_admin"],
      });

      for (const route of exportRoutes) {
        const res = await request.get(route, {
          headers: { Cookie: `logto_chronos-app=${adminCookie}` },
        });
        expect(res.status()).toBe(200);
        expect(res.headers()["content-type"]).toContain("spreadsheetml");
      }
    });
  });
});
