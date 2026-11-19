import type { Instrumentation } from "next";
import {
  redactPiiText,
  safeOperationalPath,
  writeOperationalEvent,
} from "./lib/observability";

export async function register() {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    const { registerNodeTelemetry } = await import("./instrumentation.node");
    registerNodeTelemetry();
  }
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const rawRequestId = request.headers["x-request-id"];
  const requestId = Array.isArray(rawRequestId)
    ? rawRequestId[0]
    : rawRequestId;

  const errorMessage =
    error instanceof Error ? error.message : "Unhandled request error";

  writeOperationalEvent({
    event: "request.error",
    outcome: "failure",
    requestId,
    method: request.method,
    path: safeOperationalPath(request.path),
    status: 500,
    code: context.routeType,
    error: redactPiiText(errorMessage),
  });
};
