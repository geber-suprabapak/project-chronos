import test from "node:test";
import assert from "node:assert/strict";
import { collectAuthoritativeAttendanceRows } from "../src/server/export/collector.ts";
import type {
  AstraAttendanceRecord,
  AstraStudentProfile,
} from "../src/server/export/types.ts";

test("Empirical Challenge M0 Iteration 2: Chronos Attendance Taxonomy & Export Normalization", async (t) => {
  await t.test(
    "1. Legacy 'Datang' is normalized to status 'Hadir' and actionType 'check_in'",
    async () => {
      const legacyRecords: AstraAttendanceRecord[] = [
        {
          id: "leg-1",
          user_id: "u-1",
          date: "2026-09-01",
          status: "Datang",
          action_type: null,
          created_at: "2026-09-01T07:10:00Z",
        },
        {
          id: "leg-2",
          user_id: "u-2",
          date: "2026-09-01",
          status: "Datang",
          action_type: "check_in",
          created_at: "2026-09-01T07:15:00Z",
        },
        {
          id: "can-1",
          user_id: "u-3",
          date: "2026-09-01",
          status: "Hadir",
          action_type: "check_in",
          created_at: "2026-09-01T07:20:00Z",
        },
        {
          id: "late-1",
          user_id: "u-4",
          date: "2026-09-01",
          status: "Terlambat",
          action_type: "check_in",
          created_at: "2026-09-01T07:35:00Z",
        },
      ];

      const studentProfiles: AstraStudentProfile[] = [
        {
          user_id: "u-1",
          full_name: "Student One",
          nis: "1001",
          class_name: "XII RPL 1",
        },
        {
          user_id: "u-2",
          full_name: "Student Two",
          nis: "1002",
          class_name: "XII RPL 1",
        },
        {
          user_id: "u-3",
          full_name: "Student Three",
          nis: "1003",
          class_name: "XII RPL 1",
        },
        {
          user_id: "u-4",
          full_name: "Student Four",
          nis: "1004",
          class_name: "XII RPL 1",
        },
      ];

      const rows = await collectAuthoritativeAttendanceRows(
        {},
        {
          fetchAttendance: async () => legacyRecords,
          fetchStudents: async () => studentProfiles,
        },
      );

      assert.equal(rows.length, 4);

      const leg1 = rows.find((r) => r.id === "leg-1");
      assert.ok(leg1);
      assert.equal(leg1.status, "Hadir");
      assert.equal(leg1.displayStatus, "Hadir");
      assert.equal(leg1.actionType, "check_in");

      const leg2 = rows.find((r) => r.id === "leg-2");
      assert.ok(leg2);
      assert.equal(leg2.status, "Hadir");
      assert.equal(leg2.displayStatus, "Hadir");
      assert.equal(leg2.actionType, "check_in");

      const can1 = rows.find((r) => r.id === "can-1");
      assert.ok(can1);
      assert.equal(can1.status, "Hadir");
      assert.equal(can1.displayStatus, "Hadir");
      assert.equal(can1.actionType, "check_in");

      const late1 = rows.find((r) => r.id === "late-1");
      assert.ok(late1);
      assert.equal(late1.status, "Terlambat");
      assert.equal(late1.displayStatus, "Terlambat");
      assert.equal(late1.actionType, "check_in");
    },
  );
});
