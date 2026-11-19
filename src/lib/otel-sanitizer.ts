import type { AttributeValue, Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace";
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\d)(?:\+62|62|0)8\d{8,12}\b/g;
const NIK_OR_NISN_PATTERN = /\b\d{10,16}\b/g;
const SECRET_KV_PATTERN =
  /\b(authorization|cookie|set-cookie|token|access_token|refresh_token|id_token|password|passwd|secret|code|session)\s*[:=]\s*[^\s,;]+/gi;

function redactSensitiveText(value: string): string {
  return value
    .replace(BEARER_PATTERN, "Bearer [REDACTED]")
    .replace(JWT_PATTERN, "[REDACTED_JWT]")
    .replace(SECRET_KV_PATTERN, "$1=[REDACTED]")
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(PHONE_PATTERN, "[REDACTED_PHONE]")
    .replace(NIK_OR_NISN_PATTERN, "[REDACTED_ID]");
}

function stripUrlQuery(value: string): string {
  return value.split("?")[0]?.split("#")[0] ?? "";
}

const FORBIDDEN_KEY_SUBSTRINGS = [
  "authorization",
  "cookie",
  "set-cookie",
  "token",
  "secret",
  "password",
  "passwd",
  "credential",
  "session",
  "email",
  "phone",
  "mobile",
  "nik",
  "nisn",
  "nis",
  "full_name",
  "fullname",
  "student_name",
  "user_name",
  "username",
  "address",
  "db.statement",
  "url.query",
];

const URL_ATTRIBUTE_KEYS = new Set([
  "url.full",
  "url.path",
  "http.url",
  "http.target",
  "next.route",
]);

export function isForbiddenSpanAttributeKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (normalized === "url.query") return true;
  return FORBIDDEN_KEY_SUBSTRINGS.some((needle) => {
    if (normalized === needle) return true;
    const segments = normalized.split(/[._-]/);
    return segments.includes(needle) || normalized.includes(needle);
  });
}

function isStringValue(value: AttributeValue | undefined): value is string {
  return Object.prototype.toString.call(value) === "[object String]";
}

function sanitizeAttributeValue(
  key: string,
  value: AttributeValue,
): AttributeValue | undefined {
  if (isForbiddenSpanAttributeKey(key)) {
    return undefined;
  }

  if (isStringValue(value)) {
    if (URL_ATTRIBUTE_KEYS.has(key.toLowerCase())) {
      return redactSensitiveText(stripUrlQuery(value));
    }
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      isStringValue(item) ? redactSensitiveText(item) : item,
    );
  }

  return value;
}

export function sanitizeSpanAttributes(
  attributes: Record<string, AttributeValue | undefined>,
): void {
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) {
      delete attributes[key];
      continue;
    }
    const sanitized = sanitizeAttributeValue(key, value);
    if (sanitized === undefined) {
      delete attributes[key];
    } else if (sanitized !== value) {
      attributes[key] = sanitized;
    }
  }
}

export class PiiSanitizingSpanProcessor implements SpanProcessor {
  private readonly delegate: SpanProcessor;

  constructor(delegate: SpanProcessor) {
    this.delegate = delegate;
  }

  onStart(span: Span, parentContext: Context): void {
    sanitizeSpanAttributes(span.attributes);
    this.delegate.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    sanitizeSpanAttributes(span.attributes);
    for (const event of span.events) {
      if (event.attributes) {
        sanitizeSpanAttributes(event.attributes);
      }
    }
    this.delegate.onEnd(span);
  }

  forceFlush(): Promise<void> {
    return this.delegate.forceFlush();
  }

  shutdown(): Promise<void> {
    return this.delegate.shutdown();
  }
}

export function resolveOtlpTracesEndpoint(
  envMap: Record<string, string | undefined>,
): string | undefined {
  if (envMap["OTEL_SDK_DISABLED"]?.trim().toLowerCase() === "true") {
    return undefined;
  }

  const tracesEndpoint = envMap["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"]?.trim();
  if (tracesEndpoint) {
    return tracesEndpoint;
  }

  const baseEndpoint = envMap["OTEL_EXPORTER_OTLP_ENDPOINT"]?.trim();
  if (!baseEndpoint) {
    return undefined;
  }

  const normalized = baseEndpoint.replace(/\/+$/, "");
  return normalized.endsWith("/v1/traces")
    ? normalized
    : `${normalized}/v1/traces`;
}

export function parseResourceAttributes(
  raw: string | undefined,
): Map<string, string> {
  const result = new Map<string, string>();
  if (!raw?.trim()) return result;

  for (const pair of raw.split(",")) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key && value && !isForbiddenSpanAttributeKey(key)) {
      result.set(key, redactSensitiveText(value));
    }
  }
  return result;
}
