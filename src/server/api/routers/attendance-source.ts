import { AstraRequestError, astraRequestEnvelope } from "~/lib/astra/client";
import { collectAstraPages } from "~/lib/astra/pagination";
import {
  buildAttendanceGetPath,
  buildAttendanceExportPath,
  buildAttendanceListPath,
  type AttendanceListFilter,
} from "~/server/api/routers/history-query";

export type AttendanceQuery = AttendanceListFilter;

async function fetchResource<T>(
  resource: "attendance" | "attendances",
  query: AttendanceQuery,
) {
  return collectAstraPages<T>(({ limit, offset }) => {
    const pagination = { limit, offset };
    const path = buildAttendanceListPath(resource, query, pagination);
    return astraRequestEnvelope<T[]>(path);
  });
}

async function fetchCompleteResource<T>(
  resource: "attendance" | "attendances",
  query: AttendanceQuery,
) {
  const response = await astraRequestEnvelope<T[]>(
    buildAttendanceExportPath(resource, query),
  );
  const pagination = response.meta.pagination;
  if (
    !pagination ||
    pagination.offset !== 0 ||
    pagination.has_more !== false ||
    pagination.limit !== response.data.length
  ) {
    throw new AstraRequestError(
      "Astra complete attendance collection returned invalid pagination metadata.",
      502,
      response.requestId,
      "CONTRACT_RESPONSE_INVALID",
    );
  }
  return response.data;
}

export async function fetchAllAttendanceRecords<T>(
  query: AttendanceQuery = {},
) {
  try {
    return await fetchCompleteResource<T>("attendance", query);
  } catch (error) {
    if (!(error instanceof AstraRequestError) || error.status !== 404) {
      throw error;
    }
    try {
      return await fetchCompleteResource<T>("attendances", query);
    } catch (fallbackError) {
      if (
        !(fallbackError instanceof AstraRequestError) ||
        fallbackError.status !== 404
      ) {
        throw fallbackError;
      }
      // Compatibility with Astra revisions predating the complete collection
      // route. New deployments should never reach this path.
      try {
        return await fetchResource<T>("attendance", query);
      } catch (legacyError) {
        if (
          !(legacyError instanceof AstraRequestError) ||
          legacyError.status !== 404
        ) {
          throw legacyError;
        }
        return fetchResource<T>("attendances", query);
      }
    }
  }
}

export async function fetchAttendanceRecordById<T>(
  id: string,
): Promise<T | null> {
  try {
    const envelope = await astraRequestEnvelope<T>(
      buildAttendanceGetPath("attendance", id),
    );
    return envelope.data;
  } catch (error) {
    if (error instanceof AstraRequestError && error.status === 404) {
      try {
        const fallbackEnvelope = await astraRequestEnvelope<T>(
          buildAttendanceGetPath("attendances", id),
        );
        return fallbackEnvelope.data;
      } catch (fallbackError) {
        if (
          fallbackError instanceof AstraRequestError &&
          fallbackError.status === 404
        ) {
          return null;
        }
        throw fallbackError;
      }
    }
    throw error;
  }
}
