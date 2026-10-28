import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

let currentRole = "teacher";
const mutationRequests: { url: string; body: string }[] = [];

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
    getAccessTokenRSC: async () => "mock-token",
    getLogtoContext: async () => ({
      isAuthenticated: true,
      claims: {
        sub: "user-force-finish-test",
        roles: [currentRole],
        name: "Test User",
        email: `${currentRole}@skanida.sch.id`,
      },
      userInfo: {
        email: `${currentRole}@skanida.sch.id`,
        name: "Test User",
      },
    }),
  }));
}

const { createCallerFactory } = await import("../src/server/api/trpc.ts");
const { perizinanRouter } =
  await import("../src/server/api/routers/perizinan.ts");

describe("perizinan Leave mutation authorization", () => {
  it("allows every Chronos role to make decisions and force-finish, and denies students before Astra", async () => {
    mutationRequests.length = 0;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      mutationRequests.push({
        url,
        body: String(init?.body ?? ""),
      });
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: "b0000000-0000-4000-8000-000000000001",
            user_id: "student-1",
            category: "sakit",
            status: true,
            date: "2026-09-01",
            original_end_date: "2026-09-03",
            effective_end_date: "2026-09-02",
            approval_status: "approved",
          },
          meta: { request_id: "force-finish-request" },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Astra-Contract-Version": "v1",
            "X-Request-ID": "force-finish-request",
          },
        },
      );
    };

    const caller = createCallerFactory(perizinanRouter)({
      headers: new Headers(),
      requestId: "force-finish-test",
    });
    const input = {
      id: "b0000000-0000-4000-8000-000000000001",
      effectiveEndDate: "2026-09-02",
      reason: "Student returned early",
    };

    const chronosRoles = [
      "platform_admin",
      "school_admin",
      "teacher",
      "staff",
      "admin",
      "kepala_sekolah",
      "guru",
      "wali_kelas",
    ];
    const decisions = [
      {
        input: { approvalStatus: "approved" as const, durationDays: 1 },
        path: "/approve",
      },
      {
        input: {
          approvalStatus: "rejected" as const,
          rejectionReason: "Synthetic rejection",
        },
        path: "/reject",
      },
      {
        input: { approvalStatus: "pending" as const },
        path: "/reopen",
      },
    ];

    for (const role of chronosRoles) {
      currentRole = role;
      for (const decision of decisions) {
        const result = await caller.updateStatus({
          id: input.id,
          ...decision.input,
        });
        assert.equal(result.id, input.id, `${role} can ${decision.path}`);
        assert.equal(
          mutationRequests.at(-1)?.url.endsWith(decision.path),
          true,
          `${role} reaches ${decision.path}`,
        );
      }

      const finished = await caller.forceFinish(input);
      assert.equal(finished.effectiveEndDate, "2026-09-02");
      assert.equal(
        mutationRequests.at(-1)?.url.endsWith("/force-finish"),
        true,
        `${role} reaches force-finish`,
      );
      assert.deepEqual(JSON.parse(mutationRequests.at(-1)?.body ?? "{}"), {
        effective_end_date: "2026-09-02",
        reason: "Student returned early",
      });
    }

    const allowedMutationCount = mutationRequests.length;
    for (const role of ["student", "siswa"]) {
      currentRole = role;
      await assert.rejects(caller.forceFinish(input), (error: unknown) => {
        return error instanceof TRPCError && error.code === "FORBIDDEN";
      });
      await assert.rejects(
        caller.updateStatus({
          id: input.id,
          approvalStatus: "approved",
          durationDays: 1,
        }),
        (error: unknown) =>
          error instanceof TRPCError && error.code === "FORBIDDEN",
      );
      assert.equal(mutationRequests.length, allowedMutationCount);
    }
  });
});
