import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAttendanceDateListPath,
  buildAttendanceListPath,
  buildLeaveRequestsListPath,
} from "../src/server/api/routers/history-query.ts";

test("attendance history forwards Astra's non-UUID user id", () => {
  assert.equal(
    buildAttendanceListPath("attendance", "estrb9vjja1t"),
    "/v1/admin/attendance?limit=100&user_id=estrb9vjja1t",
  );
  assert.equal(
    buildAttendanceListPath("attendance", "user/id with spaces"),
    "/v1/admin/attendance?limit=100&user_id=user%2Fid+with+spaces",
  );
});

test("date-scoped attendance queries encode filters through URLSearchParams", () => {
  assert.equal(
    buildAttendanceDateListPath("attendances", "2026-08-28"),
    "/v1/admin/attendances?date=2026-08-28&limit=100",
  );
});

test("leave history can be scoped to a non-UUID user id", () => {
  assert.equal(
    buildLeaveRequestsListPath("leave-requests", "estrb9vjja1t"),
    "/v1/admin/leave-requests?user_id=estrb9vjja1t",
  );
  assert.equal(
    buildLeaveRequestsListPath("leave-requests"),
    "/v1/admin/leave-requests",
  );
});
