import assert from "node:assert/strict";
import test from "node:test";

import { getPostLogoutRedirectUri } from "../src/lib/logto/post-logout-redirect.ts";
import { buildPendingLeaveRequestReset } from "../src/server/api/routers/perizinan-contract.ts";
import { buildScheduleUpdatePayload } from "../src/server/api/routers/jadwal-update.ts";

test("reopening a rejected leave request uses Astra's pending PATCH payload", () => {
  assert.deepEqual(buildPendingLeaveRequestReset(), {
    approval_status: "pending",
    status: false,
    rejection_reason: null,
    rejected_at: null,
  });
});

test("schedule updates contain only explicit Astra update fields", () => {
  assert.deepEqual(
    buildScheduleUpdatePayload({
      mulaiMasuk: "06:30:00",
      kompensasiWaktu: 0,
      isActive: false,
    }),
    {
      start_time: "06:30:00",
      grace_period_minutes: 0,
      is_active: false,
    },
  );
  assert.deepEqual(buildScheduleUpdatePayload({}), {});
});

test("logout redirect is configured and remains on the Chronos origin", () => {
  assert.equal(
    getPostLogoutRedirectUri(
      "https://chronos.example.test",
      "https://chronos.example.test/signed-out",
    ),
    "https://chronos.example.test/signed-out",
  );
  assert.throws(
    () => getPostLogoutRedirectUri("https://chronos.example.test", undefined),
    /LOGTO_POST_LOGOUT_REDIRECT_URI/,
  );
  assert.throws(
    () =>
      getPostLogoutRedirectUri(
        "https://chronos.example.test",
        "https://untrusted.example.test/signed-out",
      ),
    /Chronos application origin/,
  );
});
