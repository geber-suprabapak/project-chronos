import type { AstraResponse } from "~/lib/astra/client";

export class AstraPaginationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AstraPaginationError";
  }
}

interface CollectAstraPagesOptions {
  pageSize?: number;
  maxPages?: number;
}

export async function collectAstraPages<T>(
  fetchPage: (page: {
    limit: number;
    offset: number;
  }) => Promise<AstraResponse<T[]>>,
  options: CollectAstraPagesOptions = {},
) {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 200;
  const rows: T[] = [];

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new AstraPaginationError(
      "Astra page size must be between 1 and 100.",
    );
  }

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    const expectedOffset = rows.length;
    const response = await fetchPage({
      limit: pageSize,
      offset: expectedOffset,
    });
    const pagination = response.meta.pagination;

    if (
      pagination?.limit !== pageSize ||
      pagination.offset !== expectedOffset ||
      (pagination.has_more !== true && pagination.has_more !== false)
    ) {
      throw new AstraPaginationError(
        `Astra returned invalid pagination metadata (request ${response.requestId}).`,
      );
    }
    if (response.data.length > pageSize) {
      throw new AstraPaginationError(
        `Astra returned more rows than the requested page size (request ${response.requestId}).`,
      );
    }
    if (pagination.has_more && response.data.length !== pageSize) {
      throw new AstraPaginationError(
        `Astra returned an incomplete non-final page (request ${response.requestId}).`,
      );
    }

    rows.push(...response.data);
    if (!pagination.has_more) return rows;
  }

  throw new AstraPaginationError(
    `Astra pagination exceeded the ${maxPages}-page safety limit.`,
  );
}
