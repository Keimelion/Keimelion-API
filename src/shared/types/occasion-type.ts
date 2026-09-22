import type { OccasionType } from '../../db/entities/occasion-types/occasion-types.schema.js'
import type { Locale } from '../enums/locale.js'

export interface OccasionTypeDetail {
  id: string
  slug: string
  emoji: string | null
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
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
