import { AstraRequestError, astraRequestEnvelope } from "~/lib/astra/client";
import { collectAstraPages } from "~/lib/astra/pagination";

type ListEnvelope<T> = {
  data?: readonly T[] | null;
  items?: readonly T[] | null;
  rows?: readonly T[] | null;
  results?: readonly T[] | null;
};

function listRows<T>(value: readonly T[] | ListEnvelope<T> | null): T[] | null {
  if (Array.isArray(value)) return value;
  if (value === null) return null;
  if (!(
    "data" in value ||
    "items" in value ||
    "rows" in value ||
    "results" in value
  ))
    return null;
  const envelope = value;
  if (Array.isArray(envelope.data)) return envelope.data;
  if (Array.isArray(envelope.items)) return envelope.items;
  if (Array.isArray(envelope.rows)) return envelope.rows;
  if (Array.isArray(envelope.results)) return envelope.results;
  return null;
}

function withPagination(path: string, limit: number, offset: number): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}limit=${limit}&offset=${offset}`;
}

export async function fetchCompleteList<T>(path: string): Promise<T[]> {
  const first = await astraRequestEnvelope<T[] | ListEnvelope<T>>(path);
  const firstRows = listRows(first.data);
  if (firstRows === null) {
    throw new AstraRequestError(
      `Astra returned a non-list response for ${path}.`,
      502,
      first.requestId,
      "CONTRACT_RESPONSE_INVALID",
    );
  }
  const pagination = first.meta.pagination;
  if (!pagination) {
    return firstRows;
  }

  const pageSize = pagination.limit ?? -1;
  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    pagination.offset !== 0 ||
    (pagination.has_more !== true && pagination.has_more !== false) ||
    firstRows.length > pageSize ||
    (pagination.has_more && (pageSize < 1 || firstRows.length !== pageSize))
  ) {
    throw new AstraRequestError(
      `Astra returned invalid pagination metadata for ${path}.`,
      502,
      first.requestId,
      "CONTRACT_RESPONSE_INVALID",
    );
  }

  if (!pagination.has_more) return firstRows;

  const completePageSize = pageSize;

  const remaining = await collectAstraPages<T>(
    async ({ limit, offset }) => {
      const response = await astraRequestEnvelope<T[] | ListEnvelope<T>>(
        withPagination(path, limit, offset),
      );
      const rows = listRows(response.data);
      if (rows === null) {
        throw new AstraRequestError(
          `Astra returned a non-list response for ${path}.`,
          502,
          response.requestId,
          "CONTRACT_RESPONSE_INVALID",
        );
      }
      return { ...response, data: rows };
    },
    { pageSize: completePageSize },
  );

  return remaining;
}
