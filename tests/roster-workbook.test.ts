import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  canAcceptRosterReport,
  parseOfficialRosterWorkbook,
  rosterRowProvenance,
} from "../src/server/roster/parser.ts";

async function officialFixture() {
  const workbook = new ExcelJS.Workbook();
  const first = workbook.addWorksheet("X PPLG 1");
  first.getCell("C3").value = "Kelas";
  first.getCell("E3").value = ": X   PPLG  1";
  first.getCell("N3").value = "Tahun Ajaran";
  first.getCell("S3").value = ": 2026/2027";
  first.getRow(7).values = ["No", "NIS", "Nama Siswa", "L/P", "Absensi 1"];
  first.getRow(8).values = ["No", "NIS", "Nama Siswa", "L/P", 1];
  first.getRow(9).values = [
    1,
    { formula: "18001+1", result: 18002 },
    "  Siti   Aminah  ",
    " p ",
    "ignored",
  ];

  const second = workbook.addWorksheet("X AKL 1");
  second.getCell("C2").value = "Kelas";
  second.getCell("E2").value = ": X AKL 1";
  second.getCell("N2").value = "Tahun Ajaran";
  second.getCell("S2").value = ": 2026/2027";
  second.getRow(4).values = ["No", "NIS", "Nama Siswa", "L/P"];
  second.getRow(5).values = [2, 18200, "Budi Santoso", "L"];

  return workbook.xlsx.writeBuffer();
}

describe("official roster workbook parser", () => {
  it("parses variable blocks, cached formula NIS, metadata, and only official columns", async () => {
    const report = await parseOfficialRosterWorkbook(await officialFixture());

    assert.equal(report.workbookYear, "2026/2027");
    assert.equal(report.worksheetCount, 2);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.rows, [
      {
        worksheet: "X PPLG 1",
        worksheetRow: 9,
        className: "X PPLG 1",
        absenceNumber: 1,
        nis: "18002",
        fullName: "Siti Aminah",
        gender: "P",
      },
      {
        worksheet: "X AKL 1",
        worksheetRow: 5,
        className: "X AKL 1",
        absenceNumber: 2,
        nis: "18200",
        fullName: "Budi Santoso",
        gender: "L",
      },
    ]);
    assert.deepEqual(
      report.sheets.map((sheet) => sheet.worksheet),
      ["X PPLG 1", "X AKL 1"],
    );
  });

  async function invalidFixture(
    values: Partial<
      Record<"no" | "nis" | "name" | "gender", ExcelJS.CellValue>
    >,
  ) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("X PPLG 1");
    worksheet.getCell("C3").value = "Kelas";
    worksheet.getCell("E3").value = ": X PPLG 1";
    worksheet.getCell("N3").value = "Tahun Ajaran";
    worksheet.getCell("S3").value = ": 2026/2027";
    const value = (
      key: "no" | "nis" | "name" | "gender",
      fallback: ExcelJS.CellValue,
    ): ExcelJS.CellValue => {
      const candidate = values[key];
      return candidate === undefined ? fallback : candidate;
    };
    worksheet.getRow(7).values = ["No", "NIS", "Nama Siswa", "L/P"];
    worksheet.getRow(8).values = [
      value("no", 1),
      value("nis", 18001),
      value("name", "Siti Aminah"),
      value("gender", "P"),
    ];
    return workbook.xlsx.writeBuffer();
  }

  const invalidRows = [
    ["missing NIS", { nis: null }, "nis"],
    ["fractional NIS", { nis: 18001.5 }, "nis"],
    ["negative NIS", { nis: -18001 }, "nis"],
    ["unsafe NIS", { nis: Number.MAX_SAFE_INTEGER + 1 }, "nis"],
    ["uncached formula NIS", { nis: { formula: "18001+1" } }, "nis"],
    ["missing absence number", { no: null }, "absenceNumber"],
    ["fractional absence number", { no: 1.5 }, "absenceNumber"],
    ["invalid gender", { gender: "X" }, "gender"],
    ["missing full name", { name: "  " }, "fullName"],
  ] as const;

  for (const [name, values, field] of invalidRows) {
    it(`reports ${name} with worksheet-row provenance`, async () => {
      const report = await parseOfficialRosterWorkbook(
        await invalidFixture(values),
      );

      assert.equal(report.rows.length, 0);
      assert.ok(
        report.errors.some(
          (error) =>
            error.worksheet === "X PPLG 1" &&
            error.worksheetRow === 8 &&
            error.field === field,
        ),
      );
    });
  }

  it("keeps valid rows visible beside partial rows and reads an offset roster block", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("X PPLG 1");
    worksheet.getCell("C3").value = "Kelas";
    worksheet.getCell("E3").value = ": X PPLG 1";
    worksheet.getCell("N3").value = "Tahun Ajaran";
    worksheet.getCell("S3").value = ": 2026/2027";
    worksheet.getRow(7).values = [
      "Mirror",
      "Mirror",
      "No",
      "NIS",
      "Nama Siswa",
      "L/P",
    ];
    worksheet.getRow(8).values = [
      "ignored",
      "ignored",
      1,
      18001,
      "  Siti   Aminah  ",
      "P",
    ];
    worksheet.getRow(9).values = ["ignored", "ignored", 2, null, "Budi", "L"];

    const report = await parseOfficialRosterWorkbook(
      await workbook.xlsx.writeBuffer(),
    );

    assert.equal(report.totalRows, 2);
    assert.equal(report.rows.length, 1);
    assert.equal(report.rows[0]?.nis, "18001");
    assert.ok(
      report.errors.some(
        (error) => error.worksheetRow === 9 && error.field === "nis",
      ),
    );
  });

  it("ignores blank worksheets but rejects nonblank worksheets without roster structure", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Blank");
    const unknown = workbook.addWorksheet("Notes");
    unknown.getCell("A1").value = "not a roster";

    const report = await parseOfficialRosterWorkbook(
      await workbook.xlsx.writeBuffer(),
    );

    assert.equal(report.sheets.length, 0);
    assert.deepEqual(report.errors, [
      {
        worksheet: "Notes",
        worksheetRow: null,
        field: "structure",
        message:
          "Official roster headers No, NIS, Nama Siswa, and L/P were not found.",
      },
    ]);
  });

  it("rejects corrupt, encrypted, and macro-enabled packages before parsing", async () => {
    await assert.rejects(
      () => parseOfficialRosterWorkbook(new Uint8Array([1, 2, 3])),
      /workbook/i,
    );
    await assert.rejects(
      () =>
        parseOfficialRosterWorkbook(
          new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
        ),
      /encrypted|unsupported/i,
    );
    const macroMarker = Buffer.concat([
      Buffer.from(await officialFixture()),
      Buffer.from("xl/vbaProject.bin"),
    ]);
    await assert.rejects(
      () => parseOfficialRosterWorkbook(macroMarker),
      /macro-enabled/i,
    );
  });

  it("counts populated source rows, including invalid rows, for bounds", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("X PPLG 1");
    worksheet.getCell("C3").value = "Kelas";
    worksheet.getCell("E3").value = ": X PPLG 1";
    worksheet.getCell("N3").value = "Tahun Ajaran";
    worksheet.getCell("S3").value = ": 2026/2027";
    worksheet.getRow(7).values = ["No", "NIS", "Nama Siswa", "L/P"];
    for (let row = 8; row <= 108; row += 1) {
      worksheet.getRow(row).values = [
        row - 7,
        18000 + row,
        `Student ${row}`,
        "L",
      ];
    }
    worksheet.getRow(109).values = ["only a partial source row"];

    const report = await parseOfficialRosterWorkbook(
      await workbook.xlsx.writeBuffer(),
    );

    assert.equal(report.totalRows, 102);
    assert.equal(report.sheets[0]?.studentRowCount, 102);
    assert.equal(report.rows.length, 101);
    assert.ok(report.errors.some((error) => error.worksheetRow === 109));
  });

  it("keeps canonical Astra rejection classes bounded to source rows and blocks acceptance", async () => {
    const parsed = await parseOfficialRosterWorkbook(await officialFixture());
    const cases = [
      [
        "duplicate NIS",
        0,
        'Duplicate NIS "18002" in roster batch.',
        "X PPLG 1:9",
      ],
      [
        "existing NIS",
        1,
        'NIS "18200" already exists in student profiles.',
        "X AKL 1:5",
      ],
      [
        "duplicate absence number",
        0,
        "Absence Number is duplicated in this class.",
        "X PPLG 1:9",
      ],
      [
        "used absence number",
        1,
        "Absence Number is already used in this class and period.",
        "X AKL 1:5",
      ],
      [
        "unknown class",
        1,
        'Invalid class reference: "Unknown class".',
        "X AKL 1:5",
      ],
    ] as const;

    for (const [name, rowIndex, reason, provenance] of cases) {
      const rejection = { row_index: rowIndex, reason };
      assert.equal(
        rosterRowProvenance(parsed.rows, rejection.row_index),
        provenance,
        name,
      );
      assert.equal(
        canAcceptRosterReport({
          rejected_rows: 1,
          rejected_items: [rejection],
          status: "rejected",
          review_state: "rejected",
        }),
        false,
        name,
      );
    }
  });
});
