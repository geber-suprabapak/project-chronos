import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  generateAttendanceXlsx,
  buildAttendanceArtifact,
  type OrderedAttendanceRow,
} from "../src/server/export/index.ts";
import {
  makeWorkbookMetadata,
  workbookToResponseBuffer,
} from "../src/app/api/export/utils.ts";

test("Empirical M5 XLSX Export & ExcelJS Stress Test", async (t) => {
  await t.test(
    "Edge Case: 0 rows generates valid, loadable XLSX workbook",
    async () => {
      const emptyRows: OrderedAttendanceRow[] = [];
      const buf = await generateAttendanceXlsx(emptyRows, {
        title: "Data Absensi Kosong",
        worksheetName: "Absensi",
      });

      assert.ok(buf instanceof Buffer);
      assert.ok(buf.length > 0, "Buffer should not be empty");

      // Load back with ExcelJS to verify OpenXML structure
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as any);
      const ws = wb.getWorksheet("Absensi");
      assert.ok(ws, "Worksheet 'Absensi' should exist");
      assert.equal(ws.columns.length, 6, "Should have 6 columns");
      assert.equal(ws.rowCount, 1, "Only header row should exist");
    },
  );

  await t.test(
    "Stress Test: Special characters, unicode, and extreme string lengths",
    async () => {
      const edgeRows: OrderedAttendanceRow[] = [
        {
          id: "edge-01",
          userId: "u-edge-1",
          date: "2026-09-01",
          nis: "12345/001.071",
          className: "XII RPL 1 & 2 <Bilingual>",
          name: 'Muhammad Syafi\'i, S.Kom. & "Anak" <Special>',
          status: "Izin",
          displayStatus: "Izin (Sakit demam & flu berat \n rawat jalan)",
          lokasi: "-7.4503, 110.2241 (SMK Negeri 2 Magelang / 'Skanida')",
          actionType: "check_in",
          createdAt: "2026-09-01T07:15:00Z",
        },
        {
          id: "edge-02",
          userId: "u-edge-2",
          date: "2026-09-01",
          nis: "00000",
          className: "X TKJ",
          name: "A".repeat(500), // Very long string
          status: "Hadir",
          displayStatus: "Hadir",
          lokasi: "X".repeat(300),
          actionType: "check_in",
          createdAt: null,
        },
      ];

      const buf = await generateAttendanceXlsx(edgeRows);
      assert.ok(buf.length > 0);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as any);
      const ws = wb.getWorksheet("Absensi");
      assert.ok(ws);
      assert.equal(ws.rowCount, 3); // 1 header + 2 rows

      const row2 = ws.getRow(2);
      assert.equal(
        row2.getCell(4).value,
        'Muhammad Syafi\'i, S.Kom. & "Anak" <Special>',
      );
      const row3 = ws.getRow(3);
      assert.equal(row3.getCell(4).value, "A".repeat(500));
    },
  );

  await t.test(
    "Stress Test: Large dataset (2000 rows across multiple dates) completes with valid OpenXML",
    async () => {
      const largeRows: OrderedAttendanceRow[] = [];
      const dates = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"];
      for (let i = 0; i < 2000; i++) {
        const date = dates[i % dates.length]!;
        largeRows.push({
          id: `rec-${i.toString().padStart(5, "0")}`,
          userId: `u-${i}`,
          date,
          nis: `${10000 + (i % 500)}`,
          className: `XII RPL ${(i % 3) + 1}`,
          name: `Siswa Uji Coba #${i}`,
          status: i % 10 === 0 ? "Terlambat" : "Hadir",
          displayStatus: i % 10 === 0 ? "Terlambat" : "Hadir",
          lokasi: "-7.4503, 110.2241",
          actionType: "check_in",
          createdAt: `${date}T07:00:00Z`,
        });
      }

      const startTime = Date.now();
      const buf = await generateAttendanceXlsx(largeRows, {
        title: "Data Absensi Skala Besar",
        worksheetName: "Absensi_Besar",
      });
      const duration = Date.now() - startTime;

      assert.ok(buf.length > 0, "Buffer generated");
      assert.ok(
        duration < 15000,
        `Generation took ${duration}ms, must be < 15s`,
      );

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as any);
      const ws = wb.getWorksheet("Absensi_Besar");
      assert.ok(ws);
      // 2000 data rows + 1 header row + date change separator rows
      assert.ok(ws.rowCount >= 2001, `Row count was ${ws.rowCount}`);
    },
  );

  await t.test("ExcelJS Metadata and Response Buffer Utility", async () => {
    const wb = new ExcelJS.Workbook();
    Object.assign(wb, makeWorkbookMetadata("Uji Coba Metadata"));
    const ws = wb.addWorksheet("TestSheet");
    ws.columns = [{ header: "Col1", key: "col1", width: 20 }];
    ws.addRow({ col1: "Nilai" });

    const arrayBuffer = await workbookToResponseBuffer(wb);
    assert.ok(arrayBuffer.byteLength > 0);

    const checkWb = new ExcelJS.Workbook();
    await checkWb.xlsx.load(Buffer.from(arrayBuffer) as any);
    assert.equal(checkWb.title, "Uji Coba Metadata");
    assert.ok(checkWb.creator === undefined || checkWb.creator === "Unknown");
    assert.equal(checkWb.lastModifiedBy, "Chronos System");
  });

  await t.test(
    "ExcelJS Conditional Formatting / UUID generation sanity check",
    async () => {
      // exceljs uses uuidv4 in cf-rule-ext-xform.js when conditional formatting rules are added
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("CFTest");
      ws.columns = [{ header: "Angka", key: "val", width: 15 }];
      for (let i = 1; i <= 10; i++) {
        ws.addRow({ val: i });
      }

      // Add conditional formatting rule
      ws.addConditionalFormatting({
        ref: "A2:A11",
        rules: [
          {
            priority: 1,
            type: "cellIs",
            operator: "greaterThan",
            formulae: ["5"],
            style: {
              fill: {
                type: "pattern",
                pattern: "solid",
                bgColor: { argb: "FF00FF00" },
              },
            },
          },
        ],
      });

      const buf = await wb.xlsx.writeBuffer();
      assert.ok(buf.byteLength > 0);

      // Verify it loads back cleanly
      const reloadWb = new ExcelJS.Workbook();
      await reloadWb.xlsx.load(Buffer.from(buf) as any);
      const reloadWs = reloadWb.getWorksheet("CFTest");
      assert.ok(reloadWs);
      assert.equal(reloadWs.rowCount, 11);
    },
  );
});
