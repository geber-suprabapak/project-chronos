export type OperationalEvent = {
  event:
    | "astra.request"
    | "auth.failure"
    | "export.access"
    | "export.failure"
    | "trpc.error"
    | "upload.error"
    | "http.request";
  outcome: "success" | "failure";
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  code?: string;
  error?: string;
  durationMs?: number;
};

export function safeOperationalPath(
  path: string | undefined,
): string | undefined {
  if (!path) return path;
  return path.split("?")[0]?.split("#")[0];
}

export function writeOperationalEvent(event: OperationalEvent) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event,
    path: safeOperationalPath(event.path),
  });

  if (event.outcome === "failure") {
    console.error(entry);
  } else {
    console.info(entry);
  }
}
