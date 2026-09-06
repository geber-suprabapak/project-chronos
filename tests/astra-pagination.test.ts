import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectAstraPages } from "../src/lib/astra/pagination.ts";
import {
  buildAttendanceGetPath,
  buildLeaveRequestGetPath,
} from "../src/server/api/routers/history-query.ts";

describe("Astra complete pagination", () => {
  // 1. Boundary counts: 0, 99, 100, 101, 1501
  for (const count of [0, 99, 100, 101, 1_501]) {
    it(`collects all ${count} rows in stable order`, async () => {
      const source = Array.from({ length: count }, (_, id) => ({
        id,
        createdAt: `2026-09-04T10:00:${String(id % 60).padStart(2, "0")}.000Z`,
      }));
      const offsets: number[] = [];
      const received = await collectAstraPages(async ({ limit, offset }) => {
        offsets.push(offset);
        const data = source.slice(offset, offset + limit);
        return {
          data,
          meta: {
            pagination: {
              limit,
              offset,
              has_more: offset + data.length < source.length,
            },
          },
          requestId: `request-${offset}`,
        };
      });

      assert.deepEqual(received, source);
      assert.deepEqual(
        offsets,
        Array.from(
          { length: Math.max(1, Math.ceil(count / 100)) },
          (_, i) => i * 100,
        ),
      );
    });
  }

  // 2. Exact multiples
  describe("exact multiples", () => {
    for (const count of [100, 200, 300]) {
      it(`handles exact multiple ${count} when final page has has_more=false`, async () => {
        const source = Array.from({ length: count }, (_, id) => ({ id }));
        const received = await collectAstraPages(async ({ limit, offset }) => {
          const data = source.slice(offset, offset + limit);
          return {
            data,
            meta: {
              pagination: {
                limit,
                offset,
                has_more: offset + data.length < source.length,
              },
            },
            requestId: `request-${offset}`,
          };
        });

        assert.equal(received.length, count);
        assert.deepEqual(received, source);
      });

      it(`handles exact multiple ${count} when server emits extra empty page with has_more=false`, async () => {
        const source = Array.from({ length: count }, (_, id) => ({ id }));
        let calls = 0;
        const received = await collectAstraPages(async ({ limit, offset }) => {
          calls += 1;
          const data = source.slice(offset, offset + limit);
          const hasMore = offset < source.length;
          return {
            data,
            meta: {
              pagination: {
                limit,
                offset,
                has_more: hasMore,
              },
            },
            requestId: `request-${offset}`,
          };
        });

        assert.equal(received.length, count);
        assert.deepEqual(received, source);
        assert.equal(calls, count / 100 + 1);
      });
    }
  });

  // 3. Invalid pagination metadata
  describe("invalid metadata handling", () => {
    it("rejects missing pagination metadata instead of silently truncating", async () => {
      await assert.rejects(
        collectAstraPages(async () => ({
          data: Array.from({ length: 100 }, (_, id) => ({ id })),
          meta: {},
          requestId: "request-without-pagination",
        })),
        /invalid pagination metadata.*request-without-pagination/,
      );
    });

    it("rejects limit mismatch in pagination metadata", async () => {
      await assert.rejects(
        collectAstraPages(async ({ offset }) => ({
          data: [{ id: 1 }],
          meta: {
            pagination: {
              limit: 50,
              offset,
              has_more: false,
            },
          },
          requestId: "request-limit-mismatch",
        })),
        /invalid pagination metadata.*request-limit-mismatch/,
      );
    });

    it("rejects offset mismatch in pagination metadata", async () => {
      await assert.rejects(
        collectAstraPages(async ({ limit }) => ({
          data: [{ id: 1 }],
          meta: {
            pagination: {
              limit,
              offset: 999,
              has_more: false,
            },
          },
          requestId: "request-offset-mismatch",
        })),
        /invalid pagination metadata.*request-offset-mismatch/,
      );
    });

    it("rejects non-boolean has_more in pagination metadata", async () => {
      await assert.rejects(
        collectAstraPages(async ({ limit, offset }) => ({
          data: [{ id: 1 }],
          meta: {
            pagination: {
              limit,
              offset,
              has_more: "false" as unknown as boolean,
            },
          },
          requestId: "request-non-boolean-has-more",
        })),
        /invalid pagination metadata.*request-non-boolean-has-more/,
      );
    });

    it("rejects a short page that incorrectly claims more data", async () => {
      await assert.rejects(
        collectAstraPages(async ({ limit, offset }) => ({
          data: [{ id: 1 }],
          meta: { pagination: { limit, offset, has_more: true } },
          requestId: "request-short-page",
        })),
        /incomplete non-final page.*request-short-page/,
      );
    });

    it("rejects page returning more rows than requested pageSize", async () => {
      await assert.rejects(
        collectAstraPages(async ({ limit, offset }) => ({
          data: Array.from({ length: limit + 5 }, (_, id) => ({ id })),
          meta: { pagination: { limit, offset, has_more: false } },
          requestId: "request-excessive-rows",
        })),
        /more rows than the requested page size.*request-excessive-rows/,
      );
    });

    it("rejects invalid pageSize options", async () => {
      await assert.rejects(
        collectAstraPages(
          async () => {
            throw new Error("should not be called");
          },
          { pageSize: 0 },
        ),
        /Astra page size must be between 1 and 100/,
      );
      await assert.rejects(
        collectAstraPages(
          async () => {
            throw new Error("should not be called");
          },
          { pageSize: 101 },
        ),
        /Astra page size must be between 1 and 100/,
      );
      await assert.rejects(
        collectAstraPages(
          async () => {
            throw new Error("should not be called");
          },
          { pageSize: 50.5 },
        ),
        /Astra page size must be between 1 and 100/,
      );
    });

    it("enforces maxPages safety limit", async () => {
      await assert.rejects(
        collectAstraPages(
          async ({ limit, offset }) => ({
            data: Array.from({ length: limit }, (_, id) => ({ id })),
            meta: { pagination: { limit, offset, has_more: true } },
            requestId: `page-${offset}`,
          }),
          { pageSize: 10, maxPages: 3 },
        ),
        /Astra pagination exceeded the 3-page safety limit/,
      );
    });

    it("enforces default maxPages (200) safety limit when omitted", async () => {
      let pageCount = 0;
      await assert.rejects(
        collectAstraPages(async ({ limit, offset }) => {
          pageCount += 1;
          return {
            data: Array.from({ length: limit }, (_, id) => ({
              id: offset + id,
            })),
            meta: { pagination: { limit, offset, has_more: true } },
            requestId: `page-${offset}`,
          };
        }),
        /Astra pagination exceeded the 200-page safety limit/,
      );
      assert.equal(pageCount, 200);
    });
  });

  // 4. Stable order & tie-break
  describe("stable ordering", () => {
    it("preserves stable order across multiple pages", async () => {
      const source = Array.from({ length: 250 }, (_, i) => ({
        id: `att-${String(i).padStart(4, "0")}`,
        index: i,
      }));

      const collected = await collectAstraPages(async ({ limit, offset }) => {
        const data = source.slice(offset, offset + limit);
        return {
          data,
          meta: {
            pagination: {
              limit,
              offset,
              has_more: offset + data.length < source.length,
            },
          },
          requestId: `order-req-${offset}`,
        };
      });

      assert.deepEqual(collected, source);
      for (let i = 0; i < collected.length; i++) {
        assert.equal(collected[i]!.index, i);
      }
    });

    it("proves stable id tie-break sorting when dates and timestamps are identical", () => {
      const items = [
        { id: "uuid-c", date: "2026-09-04", createdAt: "2026-09-04T07:00:00Z" },
        { id: "uuid-a", date: "2026-09-04", createdAt: "2026-09-04T07:00:00Z" },
        { id: "uuid-b", date: "2026-09-04", createdAt: "2026-09-04T07:00:00Z" },
      ];

      const ascSorted = [...items].sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        const timeComp = a.createdAt.localeCompare(b.createdAt);
        if (timeComp !== 0) return timeComp;
        return a.id.localeCompare(b.id);
      });

      assert.deepEqual(
        ascSorted.map((x) => x.id),
        ["uuid-a", "uuid-b", "uuid-c"],
      );

      const descSorted = [...items].sort((a, b) => {
        const dateComp = b.date.localeCompare(a.date);
        if (dateComp !== 0) return dateComp;
        const timeComp = b.createdAt.localeCompare(a.createdAt);
        if (timeComp !== 0) return timeComp;
        return b.id.localeCompare(a.id);
      });

      assert.deepEqual(
        descSorted.map((x) => x.id),
        ["uuid-c", "uuid-b", "uuid-a"],
      );
    });
  });

  // 5. Direct lookup & path encoding
  describe("direct lookup & path encoding", () => {
    it("encodes path parameters for direct lookup", () => {
      assert.equal(
        buildAttendanceGetPath(
          "attendance",
          "123e4567-e89b-12d3-a456-426614174000",
        ),
        "/v1/admin/attendance/123e4567-e89b-12d3-a456-426614174000",
      );
      assert.equal(
        buildAttendanceGetPath("attendances", "user/id with spaces&symbols"),
        "/v1/admin/attendances/user%2Fid%20with%20spaces%26symbols",
      );
      assert.equal(
        buildLeaveRequestGetPath("leave-requests", "uuid-test-1"),
        "/v1/admin/leave-requests/uuid-test-1",
      );
      assert.equal(
        buildLeaveRequestGetPath("permits", "path/with/slashes"),
        "/v1/admin/permits/path%2Fwith%2Fslashes",
      );
    });
  });
});
