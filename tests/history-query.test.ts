import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAttendanceExportPath,
  buildAttendanceDateListPath,
  buildAttendanceGetPath,
  buildAttendanceListPath,
  buildLeaveRequestGetPath,
  buildLeaveRequestsListPath,
} from "../src/server/api/routers/history-query.ts";

test("complete attendance collection forwards supported filters", () => {
  assert.equal(
    buildAttendanceExportPath("attendance", {
      startDate: "2026-09-01",
      endDate: "2026-09-04",
      userId: "user/id",
    }),
    "/v1/admin/attendance/export?user_id=user%2Fid&start_date=2026-09-01&end_date=2026-09-04",
  );
});

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
  assert.equal(
    buildAttendanceDateListPath("attendance", "2026-09-04", {
      limit: 50,
      offset: 100,
    }),
    "/v1/admin/attendance?date=2026-09-04&limit=50&offset=100",
  );
});

test("attendance queries push date, range, and user filters", () => {
  assert.equal(
    buildAttendanceListPath(
      "attendance",
      {
        userId: "00000000-0000-0000-0000-000000000001",
        date: "2026-09-04",
      },
      { limit: 20, offset: 40 },
    ),
    "/v1/admin/attendance?limit=20&offset=40&user_id=00000000-0000-0000-0000-000000000001&date=2026-09-04",
  );
  assert.equal(
    buildAttendanceListPath(
      "attendances",
      {
        startDate: "2026-09-01",
        endDate: "2026-09-04",
      },
      { limit: 100, offset: 0 },
    ),
    "/v1/admin/attendances?limit=100&offset=0&start_date=2026-09-01&end_date=2026-09-04",
  );
});

test("direct lookup encodes path parameters safely", () => {
  assert.equal(
    buildAttendanceGetPath(
      "attendance",
      "00000000-0000-4000-8000-000000000001",
    ),
    "/v1/admin/attendance/00000000-0000-4000-8000-000000000001",
  );
  assert.equal(
    buildAttendanceGetPath("attendances", "id/with special&chars#1"),
    "/v1/admin/attendances/id%2Fwith%20special%26chars%231",
  );
  assert.equal(
    buildLeaveRequestGetPath(
      "leave-requests",
      "b0000000-0000-4000-8000-000000000001",
    ),
    "/v1/admin/leave-requests/b0000000-0000-4000-8000-000000000001",
  );
  assert.equal(
    buildLeaveRequestGetPath("permits", "test/path?foo=bar"),
    "/v1/admin/permits/test%2Fpath%3Ffoo%3Dbar",
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
