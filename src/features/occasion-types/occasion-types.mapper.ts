import type { OccasionType } from '../../db/entities/occasion-types/occasion-types.schema.js'
import type { OccasionTypeWithLabel } from '../../db/entities/occasion-types/occasion-types.repository.js'
import type { BaseOccasionType } from '../../shared/types/occasion-type.js'

export interface PublicOccasionType {
  id: string
  slug: string
  label: string
  emoji: string | null
}

export function toBaseOccasionType(row: OccasionType): BaseOccasionType {
  return {
    id: row.id,
    slug: row.slug,
    emoji: row.emoji ?? null,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toPublicOccasionType(row: OccasionTypeWithLabel): PublicOccasionType {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    emoji: row.emoji ?? null,
  }
}
