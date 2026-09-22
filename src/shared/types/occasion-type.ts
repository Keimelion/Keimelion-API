export interface OccasionTypeDetail {
  id: string
  slug: string
  emoji: string | null
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

import type { Locale } from '../enums/locale.js'

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
