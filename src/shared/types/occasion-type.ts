import type {
  OccasionType,
  OccasionTypeTranslation,
} from '../../db/entities/occasion-types/occasion-types.schema.js'
import type { Locale } from '@keimelion/sdk/enums'
import type { AdminOccasionTypeDetailParsed } from '@keimelion/sdk/schemas'

export type OccasionTypeDetail = Omit<AdminOccasionTypeDetailParsed, 'translations'>

export interface OccasionTypeRowWithTranslations extends OccasionType {
  translations: OccasionTypeTranslation[]
}

export interface OccasionTypeTranslationWrite {
  locale: Locale
  label: string
}

export interface OccasionTypeWrite {
  slug: string
  emoji: string | null
  sortOrder: number
  isActive: boolean
  translations: OccasionTypeTranslationWrite[]
}

export function toOccasionTypeDetail(row: OccasionType): OccasionTypeDetail {
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
