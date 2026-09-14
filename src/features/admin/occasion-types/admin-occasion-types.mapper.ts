import type { OccasionType, OccasionTypeTranslation } from '../../../db/entities/occasion-types/occasion-types.schema.js'

export interface AdminOccasionTypeTranslation {
  locale: string
  label: string
}

export interface AdminOccasionType {
  id: string
  slug: string
  emoji: string | null
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  translations: AdminOccasionTypeTranslation[]
}

export function toAdminOccasionType(
  row: OccasionType,
  translations: OccasionTypeTranslation[],
): AdminOccasionType {
  return {
    id: row.id,
    slug: row.slug,
    emoji: row.emoji ?? null,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    translations: translations.map((translation) => ({
      locale: translation.locale,
      label: translation.label,
    })),
  }
}
