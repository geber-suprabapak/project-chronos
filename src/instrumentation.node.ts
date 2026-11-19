import { context, propagation, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { getServiceName } from "./lib/observability";
import {
  parseResourceAttributes,
  PiiSanitizingSpanProcessor,
  resolveOtlpTracesEndpoint,
} from "./lib/otel-sanitizer";

let registered = false;

export function registerNodeTelemetry(): void {
  if (registered) return;

  const tracesEndpoint = resolveOtlpTracesEndpoint(process.env);
  if (!tracesEndpoint) {
    return;
  }

  registered = true;

  const contextManager = new AsyncLocalStorageContextManager().enable();
  context.setGlobalContextManager(contextManager);
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  const parsedAttrs = parseResourceAttributes(
    process.env["OTEL_RESOURCE_ATTRIBUTES"],
  );
  parsedAttrs.set(
    "service.namespace",
    parsedAttrs.get("service.namespace") ?? "skanida-web",
  );
  parsedAttrs.set(ATTR_SERVICE_NAME, getServiceName());

  const exporter = new OTLPTraceExporter({
    url: tracesEndpoint,
  });

  const provider = new TracerProvider({
    resource: resourceFromAttributes(Object.fromEntries(parsedAttrs)),
    spanProcessors: [
      new PiiSanitizingSpanProcessor(new BatchSpanProcessor({ exporter })),
    ],
  });

  trace.setGlobalTracerProvider(provider);
}
