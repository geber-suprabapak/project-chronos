import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  getActiveRequestId,
  runWithRequestId,
} from "../src/lib/astra/request-context.ts";
import {
  createAstraRequestId,
  buildAstraContractHeaders,
  getAstraResponseRequestId,
} from "../src/lib/astra/request-id.ts";

describe("Chronos correlation and context seam", () => {
  it("maintains isolated request ID in AsyncLocalStorage without leakage", async () => {
    assert.equal(getActiveRequestId(), undefined);

    const result1 = await runWithRequestId("req-1", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return getActiveRequestId();
    });

    const result2 = await runWithRequestId("req-2", async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      return getActiveRequestId();
    });

    assert.equal(result1, "req-1");
    assert.equal(result2, "req-2");
    assert.equal(getActiveRequestId(), undefined);
  });

  it("handles concurrent request contexts independently", async () => {
    const ids = ["concurrent-a", "concurrent-b", "concurrent-c"];
    const results = await Promise.all(
      ids.map((id) =>
        runWithRequestId(id, async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 10));
          return getActiveRequestId();
        }),
      ),
    );

    assert.deepEqual(results, ids);
  });

  it("buildAstraContractHeaders applies candidate ID and v1 contract headers", () => {
    const { headers, requestId } = buildAstraContractHeaders(
      { "Content-Type": "application/json" },
      "test-candidate-id",
    );

    assert.equal(requestId, "test-candidate-id");
    assert.equal(headers.get("X-Request-ID"), "test-candidate-id");
    assert.equal(headers.get("X-Astra-Contract-Version"), "v1");
    assert.equal(headers.get("Accept"), "application/json");
  });

  it("preserves AstraRequestError signature with status, requestId, and code", () => {
    const clientPath = join(process.cwd(), "src/lib/astra/client.ts");
    const content = readFileSync(clientPath, "utf8");

    assert.ok(
      content.includes("export class AstraRequestError extends Error"),
      "client.ts must export AstraRequestError",
    );
    assert.ok(
      content.includes("readonly status: number;"),
      "AstraRequestError must expose status: number",
    );
    assert.ok(
      content.includes("readonly requestId: string;"),
      "AstraRequestError must expose requestId: string",
    );
    assert.ok(
      content.includes("readonly code?: string;"),
      "AstraRequestError must expose optional code?: string",
    );
    assert.ok(
      content.includes("ASTRA_CONTRACT_VERSION"),
      "client.ts must verify ASTRA_CONTRACT_VERSION v1",
    );
  });

  it("verifies perizinan.ts uses canonical POST /v1/admin/leave-requests/:id/reopen", () => {
    const perizinanPath = join(
      process.cwd(),
      "src/server/api/routers/perizinan.ts",
    );
    const content = readFileSync(perizinanPath, "utf8");

    assert.ok(
      content.includes("/v1/admin/leave-requests/${input.id}/reopen"),
      "perizinan.ts must call /reopen endpoint for pending status",
    );
    assert.ok(
      content.includes('method: "POST"'),
      "perizinan.ts must use method POST for reopen",
    );
    assert.ok(
      !content.includes("buildPendingLeaveRequestReset"),
      "perizinan.ts must not rely on legacy PATCH reset payload",
    );
  });

  it("verifies middleware generates/sanitizes X-Request-ID for request and response", () => {
    const middlewarePath = join(process.cwd(), "middleware.ts");
    const content = readFileSync(middlewarePath, "utf8");

    assert.ok(
      content.includes("createAstraRequestId"),
      "middleware.ts must sanitize incoming X-Request-ID",
    );
    assert.ok(
      content.includes('requestHeaders.set("X-Request-ID", requestId)'),
      "middleware.ts must propagate X-Request-ID to downstream headers",
    );
    assert.ok(
      content.includes('res.headers.set("X-Request-ID", requestId)'),
      "middleware.ts must return X-Request-ID in response headers",
    );
  });

  it("verifies tRPC route handler and context propagate request ID without unsafe globals", () => {
    const trpcRoutePath = join(
      process.cwd(),
      "src/app/api/trpc/[trpc]/route.ts",
    );
    const trpcRouteContent = readFileSync(trpcRoutePath, "utf8");
    assert.ok(
      trpcRouteContent.includes("runWithRequestId"),
      "trpc route.ts must wrap execution in runWithRequestId",
    );
    assert.ok(
      trpcRouteContent.includes(
        'response.headers.set("X-Request-ID", requestId)',
      ),
      "trpc route.ts must attach X-Request-ID to response",
    );

    const trpcServerPath = join(process.cwd(), "src/server/api/trpc.ts");
    const trpcServerContent = readFileSync(trpcServerPath, "utf8");
    assert.ok(
      trpcServerContent.includes("createAstraRequestId"),
      "trpc.ts must sanitize requestId in createTRPCContext",
    );
    assert.ok(
      trpcServerContent.includes("withCorrelation"),
      "trpc.ts must have correlation middleware",
    );
  });

  it("verifies file proxy keeps one ID across intent/confirm but not presigned PUT", () => {
    const filesRoutePath = join(
      process.cwd(),
      "src/app/api/astra/files/route.ts",
    );
    const content = readFileSync(filesRoutePath, "utf8");

    assert.ok(
      content.includes(
        'createAstraRequestId(request.headers.get("X-Request-ID"))',
      ),
      "files route must extract and sanitize incoming request ID",
    );
    assert.ok(
      content.includes("upload-intent"),
      "files route must request upload intent",
    );
    assert.ok(content.includes("confirm"), "files route must confirm upload");
    assert.ok(
      content.includes("intentRequestId"),
      "files route must preserve intent request ID across confirm",
    );
    // Presigned PUT should only have Content-Type
    assert.ok(
      content.includes(
        'headers: { "Content-Type": entry.type || "application/octet-stream" }',
      ),
      "presigned PUT must not receive X-Request-ID or Astra contract headers",
    );
  });

  it("verifies all export routes correlate ingress X-Request-ID", () => {
    const exportRoutes = [
      "src/app/api/export/absences/route.ts",
      "src/app/api/export/perizinan/route.ts",
      "src/app/api/export/profiles/route.ts",
      "src/app/api/export/siswa/route.ts",
    ];

    for (const routePath of exportRoutes) {
      const fullPath = join(process.cwd(), routePath);
      const content = readFileSync(fullPath, "utf8");

      assert.ok(
        content.includes("createAstraRequestId"),
        `${routePath} must sanitize X-Request-ID`,
      );
      assert.ok(
        content.includes("runWithRequestId"),
        `${routePath} must wrap execution in runWithRequestId`,
      );
      assert.ok(
        content.includes('"X-Request-ID": requestId'),
        `${routePath} must return X-Request-ID in response headers`,
      );
    }
  });
});
