const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const ASTRA_CONTRACT_VERSION = "v1";

export function createAstraRequestId(candidate?: string | null): string {
  const normalized = candidate?.trim();
  return normalized && SAFE_REQUEST_ID.test(normalized)
    ? normalized
    : crypto.randomUUID();
}

export function buildAstraContractHeaders(
  initHeaders: HeadersInit = {},
  candidateRequestId?: string | null,
) {
  const headers = new Headers(initHeaders);
  const requestId = createAstraRequestId(
    candidateRequestId ?? headers.get("X-Request-ID"),
  );

  headers.set("Accept", "application/json");
  headers.set("X-Request-ID", requestId);
  headers.set("X-Astra-Contract-Version", ASTRA_CONTRACT_VERSION);

  return { headers, requestId };
}

export function getAstraResponseRequestId(
  response: Response,
  fallbackRequestId: string,
): string {
  return resolveAstraEnvelopeRequestId(
    response.headers.get("X-Request-ID"),
    fallbackRequestId,
  );
}

export function resolveAstraEnvelopeRequestId(
  candidate: string | null | undefined,
  fallbackRequestId: string,
): string {
  const normalized = candidate?.trim();
  return normalized && SAFE_REQUEST_ID.test(normalized)
    ? normalized
    : fallbackRequestId;
}
