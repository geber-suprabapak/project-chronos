import { test, expect, createMockLogtoSessionCookie } from "./fixtures/auth.ts";

test.describe("Backend Integration & API Contract Verification", () => {
  test("verifies /api/health responds with status ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ status: "ok" });
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

    test("allows teacher role to export absences and perizinan", async ({
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
    });

    test("forbids teacher role from exporting admin-only resources (siswa, profiles)", async ({
      request,
    }) => {
      const teacherCookie = await createMockLogtoSessionCookie({
        roles: ["teacher"],
      });

      const siswaRes = await request.get("/api/export/siswa", {
        headers: { Cookie: `logto_chronos-app=${teacherCookie}` },
      });
      expect(siswaRes.status()).toBe(403);

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
