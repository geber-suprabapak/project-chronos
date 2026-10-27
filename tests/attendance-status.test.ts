import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  comparePerClassRows,
  PER_CLASS_STATUS_OPTIONS,
  resolvePerClassStatusRows,
  filterPerClassStatusRows,
  type PerClassStudent,
} from "../src/lib/attendance-status.ts";

function student(
  userId: string,
  absenceNumber: string | null = null,
  fullName: string | null = userId,
): PerClassStudent {
  return { userId, nis: null, fullName, absenceNumber };
}

function buckets(
  overrides: Partial<{
    hadir: PerClassStudent[];
    terlambat: PerClassStudent[];
    sakit: PerClassStudent[];
    izin: PerClassStudent[];
    tidakHadir: PerClassStudent[];
  }> = {},
) {
  return {
    hadir: [],
    terlambat: [],
    sakit: [],
    izin: [],
    tidakHadir: [],
    ...overrides,
  };
}

describe("canonical per-class attendance status", () => {
  it("shares status and trimmed name/NIS/absence search for UI and export", () => {
    const rows = resolvePerClassStatusRows(
      buckets({
        hadir: [{ ...student("u1", "2", "Siswa Dummy"), nis: "24002" }],
        sakit: [student("u2", "3", "Other")],
      }),
    );
    assert.equal(filterPerClassStatusRows(rows, "Hadir", " DUMMY ").length, 1);
    assert.equal(filterPerClassStatusRows(rows, "", "24002").length, 1);
    assert.equal(filterPerClassStatusRows(rows, "", "3")[0]?.userId, "u2");
    assert.equal(filterPerClassStatusRows(rows, "Sakit", "24002").length, 0);
  });
  it("keeps distinct canonical roster-only students without inventing user identities", () => {
    const rows = resolvePerClassStatusRows(
      buckets({
        tidakHadir: [
          { ...student("unused"), userId: null, studentId: "s-a" },
          { ...student("unused"), userId: null, studentId: "s-b" },
        ],
      }),
    );
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.studentId),
      ["s-a", "s-b"],
    );
    assert.ok(rows.every((row) => row.userId === null));
    assert.throws(
      () =>
        resolvePerClassStatusRows(
          buckets({ tidakHadir: [{ ...student("unused"), userId: null }] }),
        ),
      /no canonical identity/,
    );
  });

  it("keeps every canonical bucket label distinct", () => {
    const rows = resolvePerClassStatusRows(
      buckets({
        hadir: [student("u-on-time", "1")],
        terlambat: [student("u-late", "2")],
        sakit: [student("u-sick", "3")],
        izin: [student("u-permit", "4")],
        tidakHadir: [student("u-absent", "5")],
      }),
    );

    assert.deepEqual(
      rows.map((row) => [row.userId, row.status]),
      [
        ["u-on-time", "Hadir"],
        ["u-late", "Terlambat"],
        ["u-sick", "Sakit"],
        ["u-permit", "Izin"],
        ["u-absent", "Belum Presensi"],
      ],
    );
  });

  it("does not collapse late into Hadir or sick into Izin", () => {
    const rows = resolvePerClassStatusRows(
      buckets({
        terlambat: [student("u-late")],
        sakit: [student("u-sick")],
      }),
    );

    const late = rows.find((row) => row.userId === "u-late")!;
    const sick = rows.find((row) => row.userId === "u-sick")!;
    assert.equal(late.status, "Terlambat");
    assert.notEqual(late.status, "Hadir");
    assert.equal(sick.status, "Sakit");
    assert.notEqual(sick.status, "Izin");

    // Per-class counts stay distinct as well.
    const count = (status: string) =>
      rows.filter((row) => row.status === status).length;
    assert.equal(count("Hadir"), 0);
    assert.equal(count("Terlambat"), 1);
    assert.equal(count("Sakit"), 1);
    assert.equal(count("Izin"), 0);
  });

  it("conserves the roster: one row per student, total equals all buckets", () => {
    const rows = resolvePerClassStatusRows(
      buckets({
        hadir: [student("u-1", "1"), student("u-2", "2")],
        terlambat: [student("u-3", "3")],
        sakit: [student("u-4", "4")],
        izin: [student("u-5", "5"), student("u-6", "6")],
        tidakHadir: [student("u-7", "7")],
      }),
    );

    assert.equal(rows.length, 7);
    assert.equal(new Set(rows.map((row) => row.userId)).size, 7);
  });

  it("resolves overlapping buckets with leave-over-presence precedence", () => {
    const rows = resolvePerClassStatusRows(
      buckets({
        hadir: [
          student("u-hadir-izin"),
          student("u-hadir-sakit"),
          student("u-hadir-only"),
        ],
        terlambat: [student("u-late-hadir")],
        izin: [student("u-hadir-izin")],
        sakit: [student("u-hadir-sakit")],
        tidakHadir: [student("u-hadir-only")],
      }),
    );

    const byUser = new Map(rows.map((row) => [row.userId, row.status]));
    // Approved leave beats a physical check-in; Sakit beats Izin.
    assert.equal(byUser.get("u-hadir-izin"), "Izin");
    assert.equal(byUser.get("u-hadir-sakit"), "Sakit");
    // A late check-in is never relabelled Hadir.
    assert.equal(byUser.get("u-late-hadir"), "Terlambat");
    // A recorded check-in beats the generic unaccounted bucket.
    assert.equal(byUser.get("u-hadir-only"), "Hadir");
  });

  it("orders rows by absence number then name, missing numbers last", () => {
    const rows = resolvePerClassStatusRows(
      buckets({
        hadir: [
          student("u-c", "10", "Cici"),
          student("u-a", "2", "Ani"),
          student("u-unnumbered", null, "Budi"),
          student("u-b", "2", "Andi"),
        ],
      }),
    );

    assert.deepEqual(
      rows.map((row) => row.userId),
      ["u-b", "u-a", "u-c", "u-unnumbered"],
    );
    assert.deepEqual(PER_CLASS_STATUS_OPTIONS, [
      "Hadir",
      "Terlambat",
      "Sakit",
      "Izin",
      "Belum Presensi",
    ]);
  });

  it("keeps the documented ordering contract for equal absence numbers", () => {
    const a = student("u-1", "5", "Andi");
    const b = student("u-2", "5", "Budi");
    const c = student("u-3", "7", "Cici");
    assert.ok(comparePerClassRows(a, b) < 0);
    assert.ok(comparePerClassRows(b, a) > 0);
    assert.ok(comparePerClassRows(c, a) > 0);
    assert.equal(comparePerClassRows(a, a), 0);
  });
});
