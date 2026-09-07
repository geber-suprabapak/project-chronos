import { getAccessTokenRSC } from "@logto/next/server-actions";
import { env } from "~/env.js";
import { logtoConfig } from "~/lib/logto/config";
import {
  ASTRA_CONTRACT_VERSION,
  buildAstraContractHeaders,
  getAstraResponseRequestId,
  resolveAstraEnvelopeRequestId,
} from "~/lib/astra/request-id";
import { getActiveRequestId } from "~/lib/astra/request-context";
import {
  safeOperationalPath,
  writeOperationalEvent,
} from "~/lib/observability";

export const DEFAULT_ASTRA_TIMEOUT_MS = 10_000;

export interface AstraRequestOptions {
  timeoutMs?: number;
}

export type AstraErrorDetailsValue =
  | string
  | number
  | boolean
  | null
  | readonly string[]
  | Readonly<Record<string, readonly string[] | undefined>>
  | undefined;

export interface AstraErrorDetailsRecord {
  [key: string]: AstraErrorDetailsValue;
  pending_request_id?: string;
  requested_start_date?: string;
  overlapping_request_id?: string;
  overlapping_start_date?: string;
  overlapping_end_date?: string;
  conflicting_dates?: readonly string[];
  requested_end_date?: string;
}

export type AstraErrorDetails =
  AstraErrorDetailsRecord | string | number | boolean | null | undefined;

export class AstraRequestError extends Error {
  readonly status: number;
  readonly requestId: string;
  readonly code?: string;
  readonly details?: AstraErrorDetails;

  constructor(
    message: string,
    status: number,
    requestId: string,
    code?: string,
    details?: AstraErrorDetails,
  ) {
    super(message);
    this.name = "AstraRequestError";
    this.status = status;
    this.requestId = requestId;
    this.code = code;
    this.details = details;
  }

  isTimeout(): boolean {
    return this.status === 504 || this.code === "TIMEOUT";
  }

  isUnavailable(): boolean {
    return (
      this.status === 503 ||
      this.code === "NETWORK_ERROR" ||
      this.code === "DEPENDENCY_UNAVAILABLE"
    );
  }

  isForbidden(): boolean {
    return this.status === 403 || this.code === "FORBIDDEN";
  }

  isNotFound(): boolean {
    return this.status === 404 || this.code === "RESOURCE_NOT_FOUND";
  }

  isContractMismatch(): boolean {
    return (
      this.code === "CONTRACT_VERSION_MISMATCH" ||
      this.code === "INVALID_ENVELOPE" ||
      this.code === "CONTRACT_VERSION_UNSUPPORTED" ||
      this.code === "CONTRACT_RESPONSE_INVALID" ||
      this.status === 502
    );
  }
}

const LEAVE_CONFLICT_CODES = new Set([
  "LEAVE_REQUEST_PENDING",
  "LEAVE_PERIOD_OVERLAP",
  "LEAVE_APPROVAL_CONFLICT",
]);

const asRecord = (
  details: AstraErrorDetails | undefined,
): AstraErrorDetailsRecord | null => {
  if (
    details === null ||
    Array.isArray(details) ||
    Object.prototype.toString.call(details) !== "[object Object]"
  ) {
    return null;
  }
  // SAFETY: Error details are decoded as the bounded Astra detail value union.
  return details as AstraErrorDetailsRecord;
};

/**
 * Converts Astra's stable leave conflict contract into a message an operator
 * can act on without losing the machine-readable error on the request.
 */
export function actionableLeaveErrorMessage(error: AstraRequestError): string {
  const details = asRecord(error.details);
  switch (error.code) {
    case "LEAVE_REQUEST_PENDING": {
      const requestId = details?.pending_request_id;
      return requestId
        ? `Pengajuan izin masih menunggu persetujuan (ID ${String(requestId)}). Tunggu hingga diproses atau ditolak sebelum mengajukan lagi.`
        : "Pengajuan izin masih menunggu persetujuan. Tunggu hingga diproses atau ditolak sebelum mengajukan lagi.";
    }
    case "LEAVE_PERIOD_OVERLAP": {
      const start = details?.overlapping_start_date;
      const end = details?.overlapping_end_date;
      const period =
        start && end ? ` (${String(start)} sampai ${String(end)})` : "";
      return `Tanggal pengajuan bertumpang tindih dengan Leave Period yang sudah disetujui${period}. Pilih tanggal lain.`;
    }
    case "LEAVE_APPROVAL_CONFLICT": {
      const dates = Array.isArray(details?.conflicting_dates)
        ? details.conflicting_dates.map(String).join(", ")
        : "tanggal yang sudah memiliki absensi fisik";
      return `Persetujuan ditolak karena absensi fisik sudah tercatat pada: ${dates}. Tidak ada bagian periode yang disetujui.`;
    }
    default:
      return error.message;
  }
}

export function isLeaveConflictError(error: AstraRequestError): boolean {
  return error.code !== undefined && LEAVE_CONFLICT_CODES.has(error.code);
}

type AstraEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code?: string;
    message?: string;
    details?: AstraErrorDetails;
  };
  meta?: {
    request_id?: string;
    timestamp?: string;
    pagination?: {
      limit?: number;
      offset?: number;
      has_more?: boolean;
    };
  };
};

export interface AstraResponse<T> {
  data: T;
  meta: NonNullable<AstraEnvelope<T>["meta"]>;
  requestId: string;
}

export async function astraRequestEnvelope<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
  options?: AstraRequestOptions,
): Promise<AstraResponse<T>> {
  const startedAt = performance.now();
  let candidateRequestId = getActiveRequestId();

  try {
    // This client is also used while rendering Server Components through the
    // server-side tRPC caller. The RSC variant deliberately does not persist a
    // refreshed token cookie, which Next.js forbids during render.
    const token = await getAccessTokenRSC(logtoConfig, env.LOGTO_RESOURCE);
    const { headers, requestId } = buildAstraContractHeaders(
      init.headers,
      candidateRequestId,
    );
    candidateRequestId = requestId;
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const timeoutMs =
      options?.timeoutMs ?? init.timeoutMs ?? DEFAULT_ASTRA_TIMEOUT_MS;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;

    let response: Response;
    try {
      response = await fetch(`${env.ASTRA_API_URL}${path}`, {
        ...init,
        headers,
        signal,
      });
    } catch (fetchError: unknown) {
      const err =
        fetchError instanceof Error
          ? fetchError
          : new Error(String(fetchError));
      if (
        err.name === "TimeoutError" ||
        (err.name === "AbortError" && timeoutSignal.aborted)
      ) {
        throw new AstraRequestError(
          `Astra request to ${path} timed out after ${timeoutMs}ms.`,
          504,
          requestId,
          "TIMEOUT",
        );
      }
      if (err instanceof TypeError || err.name === "TypeError") {
        throw new AstraRequestError(
          `Astra request to ${path} failed: ${err.message}`,
          503,
          requestId,
          "NETWORK_ERROR",
        );
      }
      if (err.name === "AbortError") {
        throw new AstraRequestError(
          `Astra request to ${path} was cancelled.`,
          499,
          requestId,
          "CANCELLED",
        );
      }
      throw new AstraRequestError(
        `Astra request to ${path} encountered a network failure: ${err.message}`,
        503,
        requestId,
        "NETWORK_ERROR",
      );
    }

    const responseRequestId = getAstraResponseRequestId(response, requestId);
    if (
      response.headers.get("X-Astra-Contract-Version") !==
      ASTRA_CONTRACT_VERSION
    ) {
      throw new AstraRequestError(
        "Astra contract version is unavailable or incompatible.",
        502,
        responseRequestId,
        "CONTRACT_VERSION_MISMATCH",
      );
    }
    // SAFETY: Astra contract header v1 was verified immediately before decoding.
    const envelope = (await response
      .json()
      .catch(() => null)) as AstraEnvelope<T> | null;
    const envelopeRequestId = resolveAstraEnvelopeRequestId(
      envelope?.meta?.request_id,
      responseRequestId,
    );
    if (!envelope) {
      throw new AstraRequestError(
        `Astra returned non-JSON or invalid envelope with status ${response.status}.`,
        response.ok ? 502 : response.status,
        envelopeRequestId,
        "INVALID_ENVELOPE",
      );
    }
    if (!response.ok || !envelope.success) {
      throw new AstraRequestError(
        envelope.error?.message ??
          envelope.message ??
          `Astra request failed with status ${response.status}.`,
        response.status,
        envelopeRequestId,
        envelope.error?.code,
        envelope.error?.details,
      );
    }
    if (!("data" in envelope)) {
      throw new AstraRequestError(
        "Astra response omitted data.",
        502,
        envelopeRequestId,
        "INVALID_ENVELOPE",
      );
    }
    writeOperationalEvent({
      event: "astra.request",
      outcome: "success",
      requestId: envelopeRequestId,
      path: safeOperationalPath(path),
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
    });
    // SAFETY: The success envelope has a data property after the contract guard.
    return {
      data: envelope.data as T,
      meta: {
        ...envelope.meta,
        request_id: envelopeRequestId,
      },
      requestId: envelopeRequestId,
    };
  } catch (error) {
    writeOperationalEvent({
      event: "astra.request",
      outcome: "failure",
      requestId:
        error instanceof AstraRequestError
          ? error.requestId
          : (candidateRequestId ?? undefined),
      path: safeOperationalPath(path),
      status: error instanceof AstraRequestError ? error.status : undefined,
      code: error instanceof AstraRequestError ? error.code : undefined,
      durationMs: Math.round(performance.now() - startedAt),
    });
    throw error;
  }
}

export async function astraRequest<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
  options?: AstraRequestOptions,
): Promise<T> {
  return (await astraRequestEnvelope<T>(path, init, options)).data;
}
