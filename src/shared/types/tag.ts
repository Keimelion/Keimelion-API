import type { Tag } from '../../db/entities/tags/tags.schema.js'

export interface TagPublic {
  id: string
  name: string
  slug: string
}

export interface TagDetail extends TagPublic {
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

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
