import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectUniqueClassNames,
  normalizeStudentRows,
} from "../src/lib/class-names.ts";

describe("class name response normalization", () => {
  it("accepts Astra list envelopes and snake/camel case field names", () => {
    assert.deepEqual(
      collectUniqueClassNames(
        { data: [{ name: "XII RPL 1" }, { class_name: "XI TKJ 2" }] },
        { items: [{ className: "XII RPL 1" }, { nama: "X AKL 1" }] },
      ),
      ["X AKL 1", "XI TKJ 2", "XII RPL 1"],
    );
  });

  it("normalizes student rows without dropping camel-case profiles", () => {
    assert.deepEqual(
      normalizeStudentRows({
        data: [
          {
            userId: "student-1",
            fullName: "Ahmad Dahlan",
            className: "XII RPL 1",
            absenceNumber: "05",
          },
        ],
      }),
      [
        {
          user_id: "student-1",
          full_name: "Ahmad Dahlan",
          email: null,
          nis: null,
          class_name: "XII RPL 1",
          absence_number: "05",
          avatar_url: null,
          role: null,
          lifecycle_status: null,
          gender: null,
        },
      ],
    );
  });

  it("retains canonical roster rows that have no bound user", () => {
    assert.deepEqual(
      normalizeStudentRows({
        data: [
          {
            student_id: "student-1",
            user_id: null,
            nis: "2001",
            full_name: "Siti Aminah",
            class_name: "XII RPL 1",
            absence_number: "7",
            gender: "P",
          },
        ],
      }),
      [
        {
          student_id: "student-1",
          user_id: null,
          full_name: "Siti Aminah",
          email: null,
          nis: "2001",
          class_name: "XII RPL 1",
          absence_number: "7",
          avatar_url: null,
          role: null,
          lifecycle_status: null,
          gender: "P",
        },
      ],
    );
  });
});
