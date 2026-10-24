import { astraRequestEnvelope } from "~/lib/astra/client";
import {
  AstraPaginationError,
  collectAstraPages,
} from "~/lib/astra/pagination";

/**
 * Collects an Astra export list completely or rejects when pagination cannot
 * prove that the returned rows are complete.
 */
export async function fetchCompleteAstraExport<T>(path: string): Promise<T[]> {
  const pagePath = (limit: number, offset: number) => {
    const url = new URL(path, "http://chronos.internal");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    return `${url.pathname}${url.search}`;
  };

  const pageSize = 100;
  const firstPage = await astraRequestEnvelope<T[]>(pagePath(pageSize, 0));
  if (!firstPage.meta.pagination) {
    if (firstPage.data.length < pageSize) return firstPage.data;
    throw new AstraPaginationError(
      `Astra returned a full export page without pagination metadata (request ${firstPage.requestId}).`,
    );
  }

  return collectAstraPages<T>(async ({ limit, offset }) => {
    if (offset === 0) return firstPage;
    return astraRequestEnvelope<T[]>(pagePath(limit, offset));
  });
}
