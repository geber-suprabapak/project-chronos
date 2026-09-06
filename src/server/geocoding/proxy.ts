export interface GeocodeResultItem {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  importance?: number;
}

export interface GeocodeResponsePayload {
  success: boolean;
  data: GeocodeResultItem[];
  meta: {
    query: string;
    count: number;
    cached: boolean;
    deduplicated?: boolean;
    durationMs: number;
  };
}

export interface GeocodeErrorPayload {
  success: false;
  error: string;
  code: string;
  retryAfter?: number;
}

export class GeocodingError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly retryAfter?: number;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_ERROR",
    retryAfter?: number,
  ) {
    super(message);
    this.name = "GeocodingError";
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

// ---------------------------------------------------------------------------
// 1. In-Memory 24-Hour TTL Cache
// ---------------------------------------------------------------------------
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export class InMemoryTtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private maxEntries: number;
  private defaultTtlMs: number;

  constructor(maxEntries = 1000, defaultTtlMs = 86_400_000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// 2. In-Flight Request Deduplicator
// ---------------------------------------------------------------------------
export class InFlightDeduplicator<T> {
  private inFlight = new Map<string, Promise<T>>();

  async execute(
    key: string,
    factory: () => Promise<T>,
  ): Promise<{ data: T; shared: boolean }> {
    const existing = this.inFlight.get(key);
    if (existing) {
      const data = await existing;
      return { data, shared: true };
    }

    const promise = (async () => {
      try {
        return await factory();
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    const data = await promise;
    return { data, shared: false };
  }

  clear(): void {
    this.inFlight.clear();
  }

  size(): number {
    return this.inFlight.size;
  }
}

// ---------------------------------------------------------------------------
// 3. Sequential Rate Limiter (1 req/sec upstream gate)
// ---------------------------------------------------------------------------
export class SequentialRateLimiter {
  private minIntervalMs: number;
  private maxWaitMs: number;
  private nextAvailableTime = 0;

  constructor(minIntervalMs = 1000, maxWaitMs = 4000) {
    this.minIntervalMs = minIntervalMs;
    this.maxWaitMs = maxWaitMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const waitMs = Math.max(0, this.nextAvailableTime - now);

    if (waitMs > this.maxWaitMs) {
      throw new GeocodingError(
        "Layanan geocoding sedang melayani permintaan lain. Silakan coba sebentar lagi.",
        429,
        "RATE_LIMITED",
        Math.max(1, Math.ceil(waitMs / 1000)),
      );
    }

    this.nextAvailableTime =
      Math.max(now, this.nextAvailableTime) + this.minIntervalMs;

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  reset(): void {
    this.nextAvailableTime = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton Instances for Application Lifetime
// ---------------------------------------------------------------------------
export const globalGeocodeCache = new InMemoryTtlCache<GeocodeResultItem[]>(
  1000,
  86_400_000, // 24 hours
);

export const globalGeocodeDeduplicator = new InFlightDeduplicator<
  GeocodeResultItem[]
>();

export const globalGeocodeRateLimiter = new SequentialRateLimiter(1000, 4000);

// ---------------------------------------------------------------------------
// Input Sanitization & Normalization
// ---------------------------------------------------------------------------
export function sanitizeAndNormalizeQuery(rawQuery: string): string {
  if (!rawQuery) return "";
  let cleaned = "";
  for (let i = 0; i < rawQuery.length; i++) {
    const code = rawQuery.charCodeAt(i);
    if (code >= 32 && code !== 127) {
      cleaned += rawQuery[i];
    }
  }
  return cleaned.trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Upstream Fetch Options
// ---------------------------------------------------------------------------
export interface GeocodeOptions {
  limit?: number;
  countrycodes?: string;
  baseUrl?: string;
  userAgent?: string;
  timeoutMs?: number;
  cache?: InMemoryTtlCache<GeocodeResultItem[]>;
  deduplicator?: InFlightDeduplicator<GeocodeResultItem[]>;
  rateLimiter?: SequentialRateLimiter;
}

/**
 * Execute geocoding lookup through cache, deduplication, rate limit, and upstream fetch.
 */
export async function executeGeocode(
  rawQuery: string,
  options: GeocodeOptions = {},
): Promise<{
  data: GeocodeResultItem[];
  cached: boolean;
  deduplicated: boolean;
  durationMs: number;
}> {
  const startTime = Date.now();
  const normalizedQuery = sanitizeAndNormalizeQuery(rawQuery);

  if (!normalizedQuery || normalizedQuery.length < 3) {
    throw new GeocodingError(
      "Parameter pencarian minimal 3 karakter.",
      400,
      "INVALID_QUERY",
    );
  }

  if (normalizedQuery.length > 100) {
    throw new GeocodingError(
      "Parameter pencarian maksimal 100 karakter.",
      400,
      "QUERY_TOO_LONG",
    );
  }

  const cache = options.cache ?? globalGeocodeCache;
  const deduplicator = options.deduplicator ?? globalGeocodeDeduplicator;
  const rateLimiter = options.rateLimiter ?? globalGeocodeRateLimiter;

  // 1. Check in-memory 24-hour cache
  const cachedData = cache.get(normalizedQuery);
  if (cachedData) {
    return {
      data: cachedData,
      cached: true,
      deduplicated: false,
      durationMs: Date.now() - startTime,
    };
  }

  // 2. In-flight Deduplication & Rate-Limited Upstream Fetch
  const limit = Math.min(Math.max(1, options.limit ?? 6), 10);
  const countrycodes = options.countrycodes ?? "id";
  const baseUrl =
    options.baseUrl ??
    process.env.NOMINATIM_BASE_URL ??
    "https://nominatim.openstreetmap.org";
  const userAgent =
    options.userAgent ??
    process.env.NOMINATIM_USER_AGENT ??
    "Skanida-Chronos/0.1.0 (internal proxy; admin@skanida.sch.id)";
  const timeoutMs = options.timeoutMs ?? 5000;

  const { data, shared } = await deduplicator.execute(
    normalizedQuery,
    async () => {
      // Re-check cache in case previous request completed while queued
      const existingAfterQueue = cache.get(normalizedQuery);
      if (existingAfterQueue) {
        return existingAfterQueue;
      }

      // Acquire slot in 1 req/sec sequencer
      await rateLimiter.acquire();

      // Third cache check right after slot acquisition
      const existingPostAcquire = cache.get(normalizedQuery);
      if (existingPostAcquire) {
        return existingPostAcquire;
      }

      const url = new URL("/search", baseUrl);
      url.searchParams.set("format", "json");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("q", normalizedQuery);
      url.searchParams.set("limit", String(limit));
      if (countrycodes) {
        url.searchParams.set("countrycodes", countrycodes);
      }

      let response: Response;
      try {
        response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "User-Agent": userAgent,
            Accept: "application/json",
            "Accept-Language": "id, en;q=0.8",
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        if (
          err instanceof Error &&
          (err.name === "TimeoutError" || err.name === "AbortError")
        ) {
          throw new GeocodingError(
            "Batas waktu permintaan geocoding terlampaui (timeout 5 detik).",
            504,
            "UPSTREAM_TIMEOUT",
          );
        }
        throw new GeocodingError(
          "Gagal menghubungi penyedia layanan geocoding.",
          502,
          "UPSTREAM_CONNECTION_ERROR",
        );
      }

      if (response.status === 429) {
        throw new GeocodingError(
          "Layanan geocoding hulu sedang membatasi permintaan. Silakan coba sebentar lagi.",
          429,
          "UPSTREAM_RATE_LIMITED",
          2,
        );
      }

      if (!response.ok) {
        throw new GeocodingError(
          `Layanan geocoding hulu merespons dengan kode ${response.status}.`,
          502,
          "UPSTREAM_ERROR",
        );
      }

      let rawData: unknown;
      try {
        rawData = await response.json();
      } catch {
        throw new GeocodingError(
          "Format respon penyedia geocoding bukan JSON yang valid.",
          502,
          "MALFORMED_RESPONSE",
        );
      }

      if (!Array.isArray(rawData)) {
        throw new GeocodingError(
          "Format data geocoding tidak valid.",
          502,
          "MALFORMED_RESPONSE",
        );
      }

      interface RawNominatimItem {
        place_id?: string | number;
        display_name?: string;
        lat?: string;
        lon?: string;
        type?: string;
        class?: string;
        importance?: number;
      }

      // SAFETY: Raw Nominatim search response contains place objects with string coordinates
      const rawList = rawData as RawNominatimItem[];
      const parsedResults: GeocodeResultItem[] = rawList
        .map((item) => ({
          place_id: String(item.place_id ?? ""),
          display_name: String(item.display_name ?? ""),
          lat: String(item.lat ?? ""),
          lon: String(item.lon ?? ""),
          type: item.type ? String(item.type) : undefined,
          class: item.class ? String(item.class) : undefined,
          importance: Number.isFinite(item.importance)
            ? item.importance
            : undefined,
        }))
        .filter((item) => item.place_id && item.lat && item.lon)
        .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
        .slice(0, limit);

      // Populate 24-hour cache
      cache.set(normalizedQuery, parsedResults);
      return parsedResults;
    },
  );

  return {
    data,
    cached: false,
    deduplicated: shared,
    durationMs: Date.now() - startTime,
  };
}
