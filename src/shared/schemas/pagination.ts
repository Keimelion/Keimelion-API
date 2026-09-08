import { z } from 'zod'
import type { PaginatedResponse } from '../types/api.js'

export const PAGINATION_DEFAULT_PAGE = 1
export const PAGINATION_DEFAULT_LIMIT = 20
export const PAGINATION_MAX_LIMIT = 100

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION_DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(PAGINATION_MAX_LIMIT).default(PAGINATION_DEFAULT_LIMIT),
})

export type PaginationInput = z.infer<typeof paginationQuerySchema>

export function buildPaginatedResponse<TItem>(
  items: TItem[],
  input: PaginationInput,
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
