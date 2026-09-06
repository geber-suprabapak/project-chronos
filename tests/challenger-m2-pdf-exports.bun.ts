import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import ExcelJS from "exceljs";

// Dynamic test context state for Logto mock
let currentRole = "school_admin";
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
    getAccessTokenRSC: async () => "mock-bearer-token-12345",
    getLogtoContext: async () => {
      if (!isAuthenticated) {
        return { isAuthenticated: false, claims: null };
      }
      return {
        isAuthenticated: true,
        claims: {
          sub: "user-admin-m2",
          roles: [currentRole],
          name: "Admin M2",
          email: `${currentRole}@skanida.sch.id`,
          must_change_password: isPasswordChangeReq,
        },
        userInfo: {
          email: `${currentRole}@skanida.sch.id`,
          name: "Admin M2",
        },
      };
    },
  }));
}

// Dynamically import routes after mocking Logto
const { GET: getProfiles } =
  await import("../src/app/api/export/profiles/route.ts");
const { GET: getSiswa } = await import("../src/app/api/export/siswa/route.ts");
const { GET: getPerizinan } =
  await import("../src/app/api/export/perizinan/route.ts");

describe("Milestone M2 Empirical Challenge: Authoritative PDF & XLSX Exports (Issue 05)", () => {
  let server: http.Server;
  let serverMode: "normal" | "empty" | "error" = "normal";

  const mockStudents = [
    {
      user_id: "stu-001",
      full_name: "Budi Santoso",
      email: "budi@skanida.sch.id",
      nis: "1001",
      class_name: "XII RPL 1",
      absence_number: "5",
      role: "student",
      lifecycle_status: "approved",
      gender: "L",
      created_at: "2026-01-10T08:00:00Z",
      updated_at: "2026-01-15T08:00:00Z",
    },
    {
      user_id: "stu-002",
      full_name: "Siti Rahma",
      email: "siti@skanida.sch.id",
      nis: "1002",
      class_name: "XII RPL 1",
      absence_number: "12",
      role: "student",
      lifecycle_status: "approved",
      gender: "P",
      created_at: "2026-01-11T08:00:00Z",
      updated_at: "2026-01-16T08:00:00Z",
    },
    {
      user_id: "stu-003",
      full_name: "Agus Pratama",
      email: "agus@skanida.sch.id",
      nis: "1003",
      class_name: "X TKJ 2",
      absence_number: "2",
      role: "student",
      lifecycle_status: "pending",
      gender: "L",
      created_at: "2026-01-12T08:00:00Z",
      updated_at: "2026-01-17T08:00:00Z",
    },
  ];

  const mockStaff = [
    {
      user_id: "staff-001",
      full_name: "Drs. Eko Prasetyo",
      email: "eko@skanida.sch.id",
      nis: "197508121999031001",
      class_name: null,
      absence_number: null,
      role: "teacher",
      roles: ["teacher"],
      lifecycle_status: "approved",
      gender: "L",
      created_at: "2025-08-01T07:00:00Z",
      updated_at: "2026-01-01T07:00:00Z",
    },
    {
      user_id: "staff-002",
      full_name: "Tri Wahyuni, S.Kom",
      email: "tri@skanida.sch.id",
      nis: null,
      class_name: null,
      absence_number: null,
      role: "staff",
      roles: ["staff"],
      lifecycle_status: "approved",
      gender: "P",
      created_at: "2025-09-01T07:00:00Z",
      updated_at: "2026-01-01T07:00:00Z",
    },
    {
      user_id: "staff-003",
      full_name: "Dra. Sri Mulyani, M.Pd",
      email: "kepsek@skanida.sch.id",
      nis: "196803251992032002",
      class_name: null,
      absence_number: null,
      role: "school_admin",
      roles: ["school_admin"],
      lifecycle_status: "approved",
      gender: "P",
      created_at: "2024-01-01T07:00:00Z",
      updated_at: "2026-01-01T07:00:00Z",
    },
  ];

  const mockLeaveRequests = [
    {
      id: "leave-001",
      user_id: "stu-001",
      student_name: "Budi Santoso",
      student_nis: "1001",
      student_class: "XII RPL 1",
      absence_number: "5",
      category: "sakit",
      description: "Demam tinggi",
      status: true,
      date: "2026-09-02",
      approval_status: "approved",
      attachment_url: "https://example.com/attachment1.jpg",
      created_at: "2026-09-02T06:30:00Z",
    },
    {
      id: "leave-002",
      user_id: "stu-002",
      student_name: "Siti Rahma",
      student_nis: "1002",
      student_class: "XII RPL 1",
      absence_number: "12",
      category: "pergi",
      description: "Acara keluarga di luar kota",
      status: false,
      date: "2026-09-03",
      approval_status: "rejected",
      rejection_reason: "Tidak ada surat izin resmi",
      created_at: "2026-09-03T07:00:00Z",
    },
    {
      id: "leave-003",
      user_id: "stu-003",
      student_name: "Agus Pratama",
      student_nis: "1003",
      student_class: "X TKJ 2",
      absence_number: "2",
      category: "lainnya",
      description: "Siswa dipulangkan karena sakit di UKS",
      status: true,
      date: "2026-09-04",
      approval_status: "pending",
      created_at: "2026-09-04T09:00:00Z",
    },
  ];

  before(async () => {
    server = http.createServer((req, res) => {
      const url = req.url ?? "";

      if (serverMode === "error") {
        res.writeHead(503, {
          "Content-Type": "application/json",
          "X-Astra-Contract-Version": "v1",
          "X-Request-ID": req.headers["x-request-id"] || "err-req-id",
        });
        res.end(
          JSON.stringify({
            success: false,
            error: {
              code: "DEPENDENCY_UNAVAILABLE",
              message: "Simulated Astra failure",
            },
            meta: { request_id: "err-req-id" },
          }),
        );
        return;
      }

      res.writeHead(200, {
        "Content-Type": "application/json",
        "X-Astra-Contract-Version": "v1",
        "X-Request-ID": req.headers["x-request-id"] || "mock-req-id",
      });

      if (url.startsWith("/v1/admin/students")) {
        res.end(
          JSON.stringify({
            success: true,
            data: serverMode === "empty" ? [] : mockStudents,
            meta: { request_id: "mock-students-id" },
          }),
        );
        return;
      }

      if (url.startsWith("/v1/admin/staff")) {
        res.end(
          JSON.stringify({
            success: true,
            data: serverMode === "empty" ? [] : mockStaff,
            meta: { request_id: "mock-staff-id" },
          }),
        );
        return;
      }

      if (url.startsWith("/v1/admin/leave-requests")) {
        res.end(
          JSON.stringify({
            success: true,
            data: serverMode === "empty" ? [] : mockLeaveRequests,
            meta: { request_id: "mock-leaves-id" },
          }),
        );
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ success: false, message: "Not found" }));
    });

    await new Promise<void>((resolve) => {
      server.listen(3000, () => {
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // --------------------------------------------------------------------------
  // TASK 3: Verify GET /api/export/{profiles,siswa,perizinan}?format=pdf
  // --------------------------------------------------------------------------
  describe("Task 3: PDF Binary Headers and Content Headers Verification", () => {
    it("3.1 GET /api/export/profiles?format=pdf returns 200, application/pdf, Content-Disposition, and %PDF- binary header", async () => {
      serverMode = "normal";
      currentRole = "school_admin";
      isAuthenticated = true;

      const req = new Request(
        "http://localhost:3000/api/export/profiles?format=pdf",
        {
          headers: { "X-Request-ID": "test-profiles-pdf" },
        },
      );

      const res = await getProfiles(req);

      assert.equal(res.status, 200, "Should return HTTP 200");
      assert.equal(
        res.headers.get("Content-Type"),
        "application/pdf",
        "Should have Content-Type application/pdf",
      );
      assert.equal(
        res.headers.get("Content-Disposition"),
        'attachment; filename="profiles.pdf"',
        "Should have correct Content-Disposition header",
      );
      assert.equal(
        res.headers.get("Cache-Control"),
        "no-store",
        "Should have Cache-Control no-store",
      );
      assert.ok(
        res.headers.get("X-Request-ID"),
        "Should preserve X-Request-ID",
      );

      const bodyBuffer = Buffer.from(await res.arrayBuffer());
      // Validate PDF magic number: %PDF- (0x25 0x50 0x44 0x46 0x2D)
      const pdfMagic = bodyBuffer.subarray(0, 5).toString("ascii");
      assert.equal(pdfMagic, "%PDF-", "Binary header must start with %PDF-");
      assert.ok(
        bodyBuffer.length > 500,
        "PDF buffer must be non-empty and substantial",
      );
    });

    it("3.2 GET /api/export/siswa?format=pdf returns 200, application/pdf, Content-Disposition, and %PDF- binary header", async () => {
      serverMode = "normal";
      currentRole = "teacher"; // Teacher is permitted for siswa per D1
      isAuthenticated = true;

      const req = new Request(
        "http://localhost:3000/api/export/siswa?format=pdf",
        {
          headers: { "X-Request-ID": "test-siswa-pdf" },
        },
      );

      const res = await getSiswa(req);

      assert.equal(res.status, 200, "Should return HTTP 200");
      assert.equal(
        res.headers.get("Content-Type"),
        "application/pdf",
        "Should have Content-Type application/pdf",
      );
      assert.equal(
        res.headers.get("Content-Disposition"),
        'attachment; filename="data-siswa.pdf"',
        "Should have correct Content-Disposition header",
      );
      assert.equal(
        res.headers.get("Cache-Control"),
        "no-store",
        "Should have Cache-Control no-store",
      );
      assert.ok(
        res.headers.get("X-Request-ID"),
        "Should preserve X-Request-ID",
      );

      const bodyBuffer = Buffer.from(await res.arrayBuffer());
      const pdfMagic = bodyBuffer.subarray(0, 5).toString("ascii");
      assert.equal(pdfMagic, "%PDF-", "Binary header must start with %PDF-");
      assert.ok(
        bodyBuffer.length > 500,
        "PDF buffer must be non-empty and substantial",
      );
    });

    it("3.3 GET /api/export/perizinan?format=pdf returns 200, application/pdf, Content-Disposition, and %PDF- binary header", async () => {
      serverMode = "normal";
      currentRole = "staff"; // Staff is permitted for perizinan per D1
      isAuthenticated = true;

      const req = new Request(
        "http://localhost:3000/api/export/perizinan?format=pdf",
        {
          headers: { "X-Request-ID": "test-perizinan-pdf" },
        },
      );

      const res = await getPerizinan(req);

      assert.equal(res.status, 200, "Should return HTTP 200");
      assert.equal(
        res.headers.get("Content-Type"),
        "application/pdf",
        "Should have Content-Type application/pdf",
      );
      assert.equal(
        res.headers.get("Content-Disposition"),
        'attachment; filename="perizinan.pdf"',
        "Should have correct Content-Disposition header",
      );
      assert.equal(
        res.headers.get("Cache-Control"),
        "no-store",
        "Should have Cache-Control no-store",
      );
      assert.ok(
        res.headers.get("X-Request-ID"),
        "Should preserve X-Request-ID",
      );

      const bodyBuffer = Buffer.from(await res.arrayBuffer());
      const pdfMagic = bodyBuffer.subarray(0, 5).toString("ascii");
      assert.equal(pdfMagic, "%PDF-", "Binary header must start with %PDF-");
      assert.ok(
        bodyBuffer.length > 500,
        "PDF buffer must be non-empty and substantial",
      );
    });
  });

  // --------------------------------------------------------------------------
  // TASK 4: Verify Profiles export includes BOTH Students and Staff, Indonesian Headers
  // --------------------------------------------------------------------------
  describe("Task 4: Profiles Whole-School Scope (D1) and Indonesian Localization", () => {
    it("4.1 GET /api/export/profiles?format=xlsx includes BOTH students and staff, and all headers in Indonesian", async () => {
      serverMode = "normal";
      currentRole = "school_admin";
      isAuthenticated = true;

      const req = new Request(
        "http://localhost:3000/api/export/profiles?format=xlsx",
        {
          headers: { "X-Request-ID": "test-profiles-xlsx" },
        },
      );

      const res = await getProfiles(req);
      assert.equal(res.status, 200);
      assert.equal(
        res.headers.get("Content-Type"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      assert.equal(
        res.headers.get("Content-Disposition"),
        'attachment; filename="profiles.xlsx"',
      );

      const arrayBuffer = await res.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      // @ts-expect-error ExcelJS buffer loading
      await wb.xlsx.load(Buffer.from(arrayBuffer));

      const ws = wb.getWorksheet("Profil Pengguna");
      assert.ok(ws, "Worksheet 'Profil Pengguna' must exist");

      // Verify exact Indonesian headers in row 1
      const headerRow = ws.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell) => {
        headers.push(String(cell.value));
      });

      const expectedHeaders = [
        "ID",
        "NIS/NIP",
        "Nama Lengkap",
        "Email",
        "Kelas",
        "Nomor Absen",
        "Peran",
        "Dibuat Pada",
        "Diperbarui Pada",
      ];
      assert.deepEqual(
        headers,
        expectedHeaders,
        "Headers must be exact Indonesian column names per D1",
      );

      // Verify all 6 records (3 students + 3 staff) are present
      // Row 1 is header, data rows start at 2
      const dataRows: Record<string, string>[] = [];
      for (let i = 2; i <= ws.rowCount; i++) {
        const row = ws.getRow(i);
        dataRows.push({
          id: String(row.getCell(1).value),
          nis: String(row.getCell(2).value),
          fullName: String(row.getCell(3).value),
          email: String(row.getCell(4).value),
          className: String(row.getCell(5).value),
          absenceNumber: String(row.getCell(6).value),
          role: String(row.getCell(7).value),
        });
      }

      assert.equal(
        dataRows.length,
        6,
        "Export must contain exactly 6 records (3 students + 3 staff)",
      );

      // Verify student records
      const budi = dataRows.find((r) => r.id === "stu-001");
      assert.ok(budi, "Student Budi must be in profiles export");
      assert.equal(budi.fullName, "Budi Santoso");
      assert.equal(budi.nis, "1001");
      assert.equal(
        budi.role,
        "Siswa",
        "Student role mapped to Indonesian 'Siswa'",
      );
      assert.equal(budi.className, "XII RPL 1");
      assert.equal(budi.absenceNumber, "5");

      // Verify staff records
      const kepsek = dataRows.find((r) => r.id === "staff-003");
      assert.ok(kepsek, "Kepsek must be in profiles export");
      assert.equal(kepsek.fullName, "Dra. Sri Mulyani, M.Pd");
      assert.equal(
        kepsek.role,
        "Admin Sekolah",
        "School admin role mapped to Indonesian 'Admin Sekolah'",
      );
      assert.equal(kepsek.className, "-", "Staff without class has '-'");
      assert.equal(
        kepsek.absenceNumber,
        "-",
        "Staff without absence number has '-'",
      );

      const guru = dataRows.find((r) => r.id === "staff-001");
      assert.ok(guru, "Teacher must be in profiles export");
      assert.equal(
        guru.role,
        "Guru",
        "Teacher role mapped to Indonesian 'Guru'",
      );
      assert.equal(guru.nis, "197508121999031001");

      const staf = dataRows.find((r) => r.id === "staff-002");
      assert.ok(staf, "Staff Tri must be in profiles export");
      assert.equal(staf.role, "Staf", "Staff role mapped to Indonesian 'Staf'");
      assert.equal(staf.nis, "-", "Staff without NIP has '-'");
    });

    it("4.2 GET /api/export/profiles?format=pdf includes both students and staff count in subtitle", async () => {
      serverMode = "normal";
      currentRole = "platform_admin";
      isAuthenticated = true;

      const req = new Request(
        "http://localhost:3000/api/export/profiles?format=pdf",
        {
          headers: { "X-Request-ID": "test-profiles-pdf-subtitle" },
        },
      );

      const res = await getProfiles(req);
      assert.equal(res.status, 200);

      const arrayBuffer = await res.arrayBuffer();
      const pdfText = Buffer.from(arrayBuffer).toString("latin1");

      // Verify Indonesian title and subtitle in generated PDF
      assert.ok(
        pdfText.includes("Data Profil Pengguna"),
        "PDF must include title 'Data Profil Pengguna'",
      );
      assert.ok(
        pdfText.includes("Total: 6 profil"),
        "PDF subtitle must report 6 total profiles (3 students + 3 staff)",
      );
    });
  });

  // --------------------------------------------------------------------------
  // ADVERSARIAL & EDGE CASE STRESS TESTS
  // --------------------------------------------------------------------------
  describe("Adversarial & Edge Cases", () => {
    it("Edge 1: Rejects unsupported format (?format=docx, ?format=html) with HTTP 400 and Indonesian error", async () => {
      for (const format of ["docx", "html", "json", "exe", "xml"]) {
        const req = new Request(
          `http://localhost:3000/api/export/profiles?format=${format}`,
        );
        const res = await getProfiles(req);
        assert.equal(
          res.status,
          400,
          `Format ${format} must be rejected with 400`,
        );
        const json = await res.json();
        assert.equal(
          json.error,
          "Format ekspor tidak didukung. Pilih 'xlsx' atau 'pdf'.",
        );
      }
    });

    it("Edge 2: Empty dataset returns valid PDF with empty fallback message without crash", async () => {
      serverMode = "empty";
      currentRole = "school_admin";
      isAuthenticated = true;

      // Profiles
      const resProfiles = await getProfiles(
        new Request("http://localhost:3000/api/export/profiles?format=pdf"),
      );
      assert.equal(resProfiles.status, 200);
      const bufProfiles = Buffer.from(await resProfiles.arrayBuffer());
      assert.equal(bufProfiles.subarray(0, 5).toString("ascii"), "%PDF-");
      assert.ok(
        /Tidak ada data[\s\S]*profil/i.test(bufProfiles.toString("latin1")),
        "Profiles PDF must contain empty fallback text",
      );

      // Siswa
      const resSiswa = await getSiswa(
        new Request("http://localhost:3000/api/export/siswa?format=pdf"),
      );
      assert.equal(resSiswa.status, 200);
      const bufSiswa = Buffer.from(await resSiswa.arrayBuffer());
      assert.equal(bufSiswa.subarray(0, 5).toString("ascii"), "%PDF-");
      assert.ok(
        /Tidak ada[\s\S]*data siswa/i.test(bufSiswa.toString("latin1")),
        "Siswa PDF must contain empty fallback text",
      );

      // Perizinan
      const resPerizinan = await getPerizinan(
        new Request("http://localhost:3000/api/export/perizinan?format=pdf"),
      );
      assert.equal(resPerizinan.status, 200);
      const bufPerizinan = Buffer.from(await resPerizinan.arrayBuffer());
      assert.equal(bufPerizinan.subarray(0, 5).toString("ascii"), "%PDF-");
      assert.ok(
        /Tidak ada data[\s\S]*perizinan/i.test(bufPerizinan.toString("latin1")),
        "Perizinan PDF must contain empty fallback text",
      );
    });

    it("Edge 3: Astra service failure returns 502/504 fail-closed with X-Request-ID", async () => {
      serverMode = "error";
      currentRole = "school_admin";
      isAuthenticated = true;

      const req = new Request(
        "http://localhost:3000/api/export/profiles?format=pdf",
        {
          headers: { "X-Request-ID": "astra-fail-req-id" },
        },
      );

      const res = await getProfiles(req);
      assert.equal(res.status >= 500, true, "Must fail closed with 5xx status");
      assert.equal(
        res.headers.get("X-Request-ID"),
        "astra-fail-req-id",
        "Must preserve X-Request-ID on error response",
      );
      const json = await res.json();
      assert.ok(json.error, "Must include descriptive error JSON");
    });

    it("Edge 4: Siswa export formatting (Gender, Status Aktivasi, Absen)", async () => {
      serverMode = "normal";
      currentRole = "teacher";
      isAuthenticated = true;

      const req = new Request(
        "http://localhost:3000/api/export/siswa?format=xlsx",
      );
      const res = await getSiswa(req);
      assert.equal(res.status, 200);

      const arrayBuffer = await res.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      // @ts-expect-error ExcelJS buffer loading
      await wb.xlsx.load(Buffer.from(arrayBuffer));

      const ws = wb.getWorksheet("Data Siswa");
      assert.ok(ws);

      // Verify headers
      const headers: string[] = [];
      ws.getRow(1).eachCell((cell) => headers.push(String(cell.value)));
      assert.deepEqual(headers, [
        "NIS",
        "Nama",
        "Kelas",
        "Absen",
        "Jenis Kelamin",
        "Status Aktivasi",
      ]);

      // Row checks
      const rows: Record<string, unknown>[] = [];
      for (let i = 2; i <= ws.rowCount; i++) {
        const r = ws.getRow(i);
        rows.push({
          nis: r.getCell(1).value,
          nama: r.getCell(2).value,
          kelas: r.getCell(3).value,
          absen: r.getCell(4).value,
          kelamin: r.getCell(5).value,
          activated: r.getCell(6).value,
        });
      }

      const budi = rows.find((r) => r.nis === "1001");
      assert.ok(budi);
      assert.equal(budi.kelamin, "Laki-laki");
      assert.equal(budi.activated, "Aktif");

      const siti = rows.find((r) => r.nis === "1002");
      assert.ok(siti);
      assert.equal(siti.kelamin, "Perempuan");
      assert.equal(siti.activated, "Aktif");

      const agus = rows.find((r) => r.nis === "1003");
      assert.ok(agus);
      assert.equal(agus.activated, "Belum Aktif");
    });

    it("Edge 5: Perizinan export formatting (Category, Indonesian Approval Status)", async () => {
      serverMode = "normal";
      currentRole = "staff";
      isAuthenticated = true;

      const req = new Request(
        "http://localhost:3000/api/export/perizinan?format=xlsx",
      );
      const res = await getPerizinan(req);
      assert.equal(res.status, 200);

      const arrayBuffer = await res.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      // @ts-expect-error ExcelJS buffer loading
      await wb.xlsx.load(Buffer.from(arrayBuffer));

      const ws = wb.getWorksheet("Perizinan");
      assert.ok(ws);

      // Verify headers
      const headers: string[] = [];
      ws.getRow(1).eachCell((cell) => headers.push(String(cell.value)));
      assert.deepEqual(headers, [
        "Tanggal",
        "NIS",
        "Kelas",
        "Nama",
        "Keterangan",
      ]);

      const rows: Record<string, unknown>[] = [];
      for (let i = 2; i <= ws.rowCount; i++) {
        const r = ws.getRow(i);
        rows.push({
          tanggal: r.getCell(1).value,
          nis: r.getCell(2).value,
          kelas: r.getCell(3).value,
          nama: r.getCell(4).value,
          keterangan: r.getCell(5).value,
        });
      }

      // Check approval statuses in keterangan
      const budiLeave = rows.find((r) => r.nis === "1001");
      assert.ok(budiLeave);
      assert.ok(
        String(budiLeave.keterangan).includes("(Disetujui)"),
        "Approved leave must have '(Disetujui)'",
      );

      const sitiLeave = rows.find((r) => r.nis === "1002");
      assert.ok(sitiLeave);
      assert.ok(
        String(sitiLeave.keterangan).includes("(Ditolak)"),
        "Rejected leave must have '(Ditolak)'",
      );

      const agusLeave = rows.find((r) => r.nis === "1003");
      assert.ok(agusLeave);
      assert.ok(
        String(agusLeave.keterangan).includes("(Menunggu)"),
        "Pending leave must have '(Menunggu)'",
      );
      assert.ok(
        String(agusLeave.keterangan).includes("Dipulangkan"),
        "Leave with 'dipulangkan' in desc must format as 'Dipulangkan'",
      );
    });
  });
});
