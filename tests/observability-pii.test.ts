import assert from "node:assert/strict";
import test from "node:test";
import { context, propagation, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from "@opentelemetry/sdk-trace";
import {
  injectTraceHeaders,
  redactPiiText,
  safeOperationalPath,
  writeOperationalEvent,
} from "../src/lib/observability.ts";
import {
  PiiSanitizingSpanProcessor,
  resolveOtlpTracesEndpoint,
} from "../src/lib/otel-sanitizer.ts";

test("PiiSanitizingSpanProcessor strips sensitive headers, PII attributes, and query secrets", () => {
  const exporter = new InMemorySpanExporter();
  const processor = new PiiSanitizingSpanProcessor(
    new SimpleSpanProcessor({ exporter }),
  );
  const provider = new TracerProvider({
    spanProcessors: [processor],
  });

  const tracer = provider.getTracer("chronos-test");
  const span = tracer.startSpan("GET /api/trpc/students", {
    attributes: {
      "http.request.method": "GET",
      "http.request.header.authorization": "Bearer secret-jwt-token",
      "http.request.header.cookie": "logto_session=abc123",
      "http.response.header.set-cookie": "session=xyz",
      "url.full":
        "https://admin.skanida.test/api/logto/callback?code=secret-code&state=123",
      "url.query": "email=siswa@skanida.sch.id&nisn=0012345678",
      "student.email": "siswa@skanida.sch.id",
      "student.nik": "3308123456789012",
      "student.phone": "081234567890",
      "student.full_name": "Budi Santoso",
      "custom.note":
        "Contact siswa@skanida.sch.id or Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.sig123456789",
    },
  });
  span.end();

  const finished = exporter.getFinishedSpans();
  assert.equal(finished.length, 1);
  const attrs = finished[0]!.attributes;

  assert.equal(attrs["http.request.method"], "GET");
  assert.equal(attrs["http.request.header.authorization"], undefined);
  assert.equal(attrs["http.request.header.cookie"], undefined);
  assert.equal(attrs["http.response.header.set-cookie"], undefined);
  assert.equal(attrs["url.query"], undefined);
  assert.equal(attrs["student.email"], undefined);
  assert.equal(attrs["student.nik"], undefined);
  assert.equal(attrs["student.phone"], undefined);
  assert.equal(attrs["student.full_name"], undefined);
  assert.equal(
    attrs["url.full"],
    "https://admin.skanida.test/api/logto/callback",
  );
  assert.equal(
    attrs["custom.note"],
    "Contact [REDACTED_EMAIL] or Bearer [REDACTED]",
  );
});

test("writeOperationalEvent and injectTraceHeaders correlate active traceId/spanId and redact PII", () => {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
  });
  const contextManager = new AsyncLocalStorageContextManager().enable();
  context.setGlobalContextManager(contextManager);
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(provider);

  const logs: string[] = [];
  const origError = console.error;
  console.error = (msg: string) => logs.push(msg);

  try {
    const tracer = trace.getTracer("chronos-test");
    tracer.startActiveSpan("astra GET /v1/admin/students", (span) => {
      const headers = new Headers();
      injectTraceHeaders(headers);
      const traceparent = headers.get("traceparent");
      assert.ok(traceparent, "traceparent header should be injected");
      assert.match(traceparent, /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);

      writeOperationalEvent({
        event: "astra.request",
        outcome: "failure",
        requestId: "req-123",
        method: "GET",
        path: "/v1/admin/students?q=siswa@skanida.sch.id&token=abc",
        status: 502,
        durationMs: 42,
        error: "Failed for siswa@skanida.sch.id with NIK 3308123456789012",
      });
      span.end();
    });
  } finally {
    console.error = origError;
    trace.disable();
    propagation.disable();
    context.disable();
  }

  assert.equal(logs.length, 1);
  const parsed = JSON.parse(logs[0]!) as Record<string, string | number>;
  assert.equal(parsed["service"], "chronos");
  assert.equal(parsed["requestId"], "req-123");
  assert.equal(parsed["path"], "/v1/admin/students");
  assert.equal(parsed["status"], 502);
  assert.equal(parsed["durationMs"], 42);
  assert.match(String(parsed["traceId"]), /^[0-9a-f]{32}$/);
  assert.match(String(parsed["spanId"]), /^[0-9a-f]{16}$/);
  assert.equal(
    parsed["error"],
    "Failed for [REDACTED_EMAIL] with NIK [REDACTED_ID]",
  );
});

test("resolveOtlpTracesEndpoint is opt-in and normalizes base endpoints", () => {
  assert.equal(resolveOtlpTracesEndpoint({}), undefined);
  assert.equal(
    resolveOtlpTracesEndpoint({
      OTEL_SDK_DISABLED: "true",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://tempo.monitoring:4318",
    }),
    undefined,
  );
  assert.equal(
    resolveOtlpTracesEndpoint({
      OTEL_EXPORTER_OTLP_ENDPOINT:
        "http://tempo.monitoring.svc.cluster.local:4318",
    }),
    "http://tempo.monitoring.svc.cluster.local:4318/v1/traces",
  );
  assert.equal(
    resolveOtlpTracesEndpoint({
      OTEL_EXPORTER_OTLP_ENDPOINT:
        "http://tempo.monitoring.svc.cluster.local:4318/v1/traces",
    }),
    "http://tempo.monitoring.svc.cluster.local:4318/v1/traces",
  );
  assert.equal(
    safeOperationalPath("https://admin.test/api/test?code=123#frag"),
    "https://admin.test/api/test",
  );
  const redacted = redactPiiText(
    "Authorization: Bearer abc.def.ghi phone 081234567890",
  );
  assert.ok(!redacted.includes("abc.def.ghi"));
  assert.ok(!redacted.includes("081234567890"));
  assert.ok(redacted.includes("[REDACTED_PHONE]"));
});
