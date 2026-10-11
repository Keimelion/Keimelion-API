import { and, asc, count, ilike, type SQL } from 'drizzle-orm'
import { HttpStatus } from '../../shared/enums/http.js'
import { db } from '../../db/client.js'
import { tags } from '../../db/entities/tags/tags.schema.js'
import { buildPaginatedResponse } from '../../shared/schemas/pagination.js'
import { toTagPublic } from '../../shared/types/tag.js'
import type { TagPublic } from '../../shared/types/tag.js'
import type { PaginationInput } from '../../shared/schemas/pagination.js'
import type { PaginatedResponse } from '../../shared/types/api.js'
import type { ServiceResult } from '../../shared/types/service.js'

export interface ListTagsPublicInput extends PaginationInput {
  name?: string
}

export async function listPublicTags(
  input: ListTagsPublicInput,
): Promise<ServiceResult<PaginatedResponse<TagPublic>>> {
  const whereClause = buildPublicTagsWhere(input.name)
  const offset = (input.page - 1) * input.limit

  const [rows, total] = await Promise.all([
    db.query.tags.findMany({
      where: whereClause,
      orderBy: [asc(tags.name)],
      limit: input.limit,
      offset,
    }),
    countPublicTags(whereClause),
  ])

  return {
    data: buildPaginatedResponse(rows.map(toTagPublic), input, total),
    httpStatus: HttpStatus.OK,
  }
}

function buildPublicTagsWhere(name: string | undefined): SQL | undefined {
  if (name === undefined || name.length === 0) return undefined
  return and(ilike(tags.name, `%${name}%`))
}

async function countPublicTags(whereClause: SQL | undefined): Promise<number> {
  const [row] = await db.select({ count: count() }).from(tags).where(whereClause)
  return row?.count ?? 0
}
