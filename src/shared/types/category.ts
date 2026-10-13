import { DEFAULT_LOCALE } from '../enums/locale.js'
import type { Locale } from '../enums/locale.js'
import type {
  Category,
  CategoryTranslation,
} from '../../db/entities/categories/categories.schema.js'

export interface CategoryPublic {
  id: string
  parentId: string | null
  name: string
  slug: string
  depth: number
}

export interface CategoryTreeNode extends CategoryPublic {
  children: CategoryTreeNode[]
}

export interface CategoryRowWithResolvedName {
  id: string
  parentId: string | null
  slug: string
  depth: number
  name: string
}

export interface CategoryRowWithTranslations extends Category {
  translations: CategoryTranslation[]
}

export type CategoryTranslationsDict = Partial<Record<Locale, string>>

export interface AdminCategoryDetail {
  id: string
  parentId: string | null
  slug: string
  depth: number
  translations: CategoryTranslationsDict
  createdAt: Date
  updatedAt: Date
}

export function toCategoryPublic(row: CategoryRowWithResolvedName): CategoryPublic {
  return {
    id: row.id,
    parentId: row.parentId ?? null,
    name: row.name,
    slug: row.slug,
    depth: row.depth,
  }
}

export function resolveCategoryName(
  translations: readonly CategoryTranslation[],
  locale: Locale,
): string {
  const match = translations.find((translation) => translation.locale === locale)
  if (match) return match.name
  const fallback = translations.find((translation) => translation.locale === DEFAULT_LOCALE)
  return fallback?.name ?? ''
}

export function toTranslationsDict(
  translations: readonly CategoryTranslation[],
): CategoryTranslationsDict {
  const dict: CategoryTranslationsDict = {}
  for (const translation of translations) {
    dict[translation.locale] = translation.name
  }
  return dict
}

export function toAdminCategoryDetail(row: CategoryRowWithTranslations): AdminCategoryDetail {
  return {
    id: row.id,
    parentId: row.parentId ?? null,
    slug: row.slug,
    depth: row.depth,
    translations: toTranslationsDict(row.translations),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
