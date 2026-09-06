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
let mockMode: "normal" | "empty" | "rate_limited" | "slow" | "error" = "normal";
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

    if (mockMode === "slow") {
      // Delay response by 6 seconds (exceeds 5000ms timeout)
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
      }, 6000);
      return;
    }

    if (mockMode === "empty") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([]));
      return;
    }

    // Normal successful response
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify([
        {
          place_id: 101,
          display_name: "SMK Negeri 2 Magelang, Jawa Tengah, Indonesia",
          lat: "-7.449946",
          lon: "110.223797",
          type: "school",
          class: "amenity",
          importance: 0.75,
        },
        {
          place_id: 102,
          display_name: "Magelang Central, Jawa Tengah, Indonesia",
          lat: "-7.450000",
          lon: "110.224000",
          type: "administrative",
          class: "boundary",
          importance: 0.6,
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

describe("Geocoding Proxy & Engine Unit Tests", () => {
  let testCache: InMemoryTtlCache<GeocodeResultItem[]>;
  let testDeduplicator: InFlightDeduplicator<GeocodeResultItem[]>;
  let testRateLimiter: SequentialRateLimiter;

  beforeEach(() => {
    mockMode = "normal";
    receivedHeaders = {};
    receivedUrls = [];
    upstreamRequestCount = 0;
    testCache = new InMemoryTtlCache<GeocodeResultItem[]>(100, 86_400_000);
    testDeduplicator = new InFlightDeduplicator<GeocodeResultItem[]>();
    testRateLimiter = new SequentialRateLimiter(50, 1000); // 50ms interval for fast unit tests
  });

  it("1. validates query parameter: rejects empty or short query (< 3 chars)", async () => {
    await assert.rejects(
      async () => {
        await executeGeocode("ab", {
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

    assert.equal(
      upstreamRequestCount,
      0,
      "Upstream must not be called on invalid query",
    );
  });

  it("2. normalizes whitespace and control characters in queries", () => {
    const raw = "   SMK \x00\x1F Negeri    2   ";
    const normalized = sanitizeAndNormalizeQuery(raw);
    assert.equal(normalized, "smk negeri 2");
  });

  it("3. sends compliant User-Agent and formats request parameters upstream", async () => {
    const result = await executeGeocode("SMK Negeri 2", {
      baseUrl: `http://127.0.0.1:${mockPort}`,
      userAgent: "Skanida-Chronos/0.1.0 (internal proxy; admin@skanida.sch.id)",
      cache: testCache,
      deduplicator: testDeduplicator,
      rateLimiter: testRateLimiter,
    });

    assert.equal(result.cached, false);
    assert.equal(result.data.length, 2);
    assert.equal(result.data[0]?.place_id, "101");
    assert.equal(result.data[0]?.lat, "-7.449946");
    assert.equal(result.data[0]?.lon, "110.223797");

    assert.equal(
      receivedHeaders["user-agent"],
      "Skanida-Chronos/0.1.0 (internal proxy; admin@skanida.sch.id)",
      "Must send compliant User-Agent to upstream",
    );
    assert.ok(receivedUrls[0]?.includes("q=smk+negeri+2"));
    assert.ok(receivedUrls[0]?.includes("countrycodes=id"));
  });

  it("4. verifies 24-hour cache hits and eliminates redundant upstream requests", async () => {
    const opts = {
      baseUrl: `http://127.0.0.1:${mockPort}`,
      cache: testCache,
      deduplicator: testDeduplicator,
      rateLimiter: testRateLimiter,
    };

    // First request: Cache MISS
    const res1 = await executeGeocode("Borobudur", opts);
    assert.equal(res1.cached, false);
    assert.equal(upstreamRequestCount, 1);

    // Second request with case and whitespace variation: Cache HIT
    const res2 = await executeGeocode("  borobudur  ", opts);
    assert.equal(res2.cached, true);
    assert.equal(
      upstreamRequestCount,
      1,
      "Upstream request count must not increment on cache hit",
    );
    assert.deepEqual(res1.data, res2.data);
  });

  it("5. deduplicates simultaneous in-flight requests into a single upstream call", async () => {
    const opts = {
      baseUrl: `http://127.0.0.1:${mockPort}`,
      cache: testCache,
      deduplicator: testDeduplicator,
      rateLimiter: testRateLimiter,
    };

    // Fire 3 simultaneous requests for the exact same query
    const [call1, call2, call3] = await Promise.all([
      executeGeocode("Candi Mendut", opts),
      executeGeocode("Candi Mendut", opts),
      executeGeocode("Candi Mendut", opts),
    ]);

    assert.equal(
      upstreamRequestCount,
      1,
      "Must only issue ONE upstream request for identical in-flight queries",
    );
    assert.deepEqual(call1.data, call2.data);
    assert.deepEqual(call2.data, call3.data);
    assert.ok(
      call2.deduplicated || call3.deduplicated,
      "At least one call should report deduplicated: true",
    );
  });

  it("6. translates upstream HTTP 429 into structured rate limit error with Retry-After", async () => {
    mockMode = "rate_limited";
    const opts = {
      baseUrl: `http://127.0.0.1:${mockPort}`,
      cache: testCache,
      deduplicator: testDeduplicator,
      rateLimiter: testRateLimiter,
    };

    await assert.rejects(
      async () => {
        await executeGeocode("Pusat Kota", opts);
      },
      (err: unknown) => {
        assert.ok(err instanceof GeocodingError);
        assert.equal(err.statusCode, 429);
        assert.equal(err.code, "UPSTREAM_RATE_LIMITED");
        assert.equal(err.retryAfter, 2);
        return true;
      },
    );
  });

  it("7. enforces 5-second timeout abort and returns HTTP 504", async () => {
    mockMode = "slow";
    const opts = {
      baseUrl: `http://127.0.0.1:${mockPort}`,
      cache: testCache,
      deduplicator: testDeduplicator,
      rateLimiter: testRateLimiter,
      timeoutMs: 150, // fast timeout for test execution
    };

    await assert.rejects(
      async () => {
        await executeGeocode("Mungkid", opts);
      },
      (err: unknown) => {
        assert.ok(err instanceof GeocodingError);
        assert.equal(err.statusCode, 504);
        assert.equal(err.code, "UPSTREAM_TIMEOUT");
        return true;
      },
    );
  });

  it("8. handles empty results gracefully with HTTP 200 and empty data array", async () => {
    mockMode = "empty";
    const opts = {
      baseUrl: `http://127.0.0.1:${mockPort}`,
      cache: testCache,
      deduplicator: testDeduplicator,
      rateLimiter: testRateLimiter,
    };

    const result = await executeGeocode("Lokasi Tidak Dikenal 12345", opts);
    assert.equal(result.cached, false);
    assert.deepEqual(result.data, []);
  });
});
