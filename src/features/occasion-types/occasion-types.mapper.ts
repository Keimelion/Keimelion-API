import type { OccasionTypeWithLabel } from '../../db/entities/occasion-types/occasion-types.repository.js'
import type { OccasionTypeSummaryParsed } from '@keimelion/sdk/schemas'

export type PublicOccasionType = OccasionTypeSummaryParsed

export function toPublicOccasionType(row: OccasionTypeWithLabel): PublicOccasionType {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    emoji: row.emoji ?? null,
  }
}
