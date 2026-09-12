import type { OccasionType } from '../../db/entities/occasion-types/occasion-types.schema.js'

export interface PublicOccasionType {
  id: string
  slug: string
  label: string
  emoji: string | null
}

export function toPublicOccasionType(row: OccasionType): PublicOccasionType {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    emoji: row.emoji ?? null,
  }
}
