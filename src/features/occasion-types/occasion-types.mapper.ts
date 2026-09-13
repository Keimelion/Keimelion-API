import type { OccasionTypeWithLabel } from '../../db/entities/occasion-types/occasion-types.repository.js'

export interface PublicOccasionType {
  id: string
  slug: string
  label: string
  emoji: string | null
}

export function toPublicOccasionType(row: OccasionTypeWithLabel): PublicOccasionType {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    emoji: row.emoji ?? null,
  }
}
