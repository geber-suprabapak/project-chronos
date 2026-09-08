import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseOfficialRosterWorkbook } from "../src/server/roster/parser.ts";

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
});
