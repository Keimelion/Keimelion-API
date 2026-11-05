import type { PaginatedResponse, PaginationQueryParsed } from '@keimelion/sdk/schemas'

export function getOffset(input: PaginationQueryParsed): number {
  return (input.page - 1) * input.limit
}

export function buildPaginatedResponse<TItem>(
  items: TItem[],
  input: PaginationQueryParsed,
  total: number,
): PaginatedResponse<TItem> {
  return {
    items,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  }
}
