import type { Tag } from '../../db/entities/tags/tags.schema.js'
import type { TagDetailParsed, TagSummaryParsed } from '@keimelion/sdk/schemas'

export type TagPublic = TagSummaryParsed

export type TagDetail = TagDetailParsed

export function toTagPublic(row: Tag): TagPublic {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
  }
}

export function toTagDetail(row: Tag): TagDetail {
  return {
    ...toTagPublic(row),
    createdByUserId: row.createdByUserId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
