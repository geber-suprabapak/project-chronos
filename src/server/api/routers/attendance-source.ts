import { AstraRequestError, astraRequestEnvelope } from "~/lib/astra/client";
import { collectAstraPages } from "~/lib/astra/pagination";
import {
  buildAttendanceGetPath,
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

export async function fetchAllAttendanceRecords<T>(
  query: AttendanceQuery = {},
) {
  try {
    return await fetchResource<T>("attendance", query);
  } catch (error) {
    if (!(error instanceof AstraRequestError) || error.status !== 404) {
      throw error;
    }
    return fetchResource<T>("attendances", query);
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
