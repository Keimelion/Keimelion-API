import type { db } from '../../db/client.js'
import { ErrorCode } from '../enums/error-code.js'
import { normalizeTagSlugs } from '../utils/slug.js'
import { findCategoriesByIds } from '../../db/entities/categories/categories.repository.js'
import { replaceItemCategories } from '../../db/entities/item-categories/item-categories.repository.js'
import { upsertTagsBySlugs } from '../../db/entities/tags/tags.repository.js'
import { replaceItemTags } from '../../db/entities/item-tags/item-tags.repository.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

// null = leave the relation untouched; [] = clear it.
export interface ItemRelations {
  tagSlugs: string[] | null
  categoryIds: string[] | null
}

interface ItemRelationsWrite {
  itemId: string
  tagCreatorId: string | null
  relations: ItemRelations
}

export async function resolveItemRelations(
  tags: string[] | undefined,
  categories: string[] | undefined,
): Promise<ItemRelations | { errorCode: ErrorCode }> {
  const tagSlugs = tags === undefined ? null : normalizeTagSlugs(tags)
  if (tags !== undefined && tagSlugs === null) return { errorCode: ErrorCode.TAG_INVALID_NAME }

  const categoryIds = categories === undefined ? null : Array.from(new Set(categories))
  if (categoryIds !== null && !(await areAllCategoriesFound(categoryIds))) {
    return { errorCode: ErrorCode.CATEGORY_NOT_FOUND }
  }
  return { tagSlugs, categoryIds }
}

async function areAllCategoriesFound(categoryIds: string[]): Promise<boolean> {
  if (categoryIds.length === 0) return true
  const found = await findCategoriesByIds(categoryIds)
  return found.length === categoryIds.length
}

export async function writeItemRelations(write: ItemRelationsWrite, tx: DbTransaction): Promise<void> {
  const { itemId, tagCreatorId, relations } = write
  if (relations.tagSlugs !== null) {
    const tagIds = await upsertTagsBySlugs(relations.tagSlugs, tagCreatorId, tx)
    await replaceItemTags(itemId, tagIds, tx)
  }
  if (relations.categoryIds !== null) {
    await replaceItemCategories(itemId, relations.categoryIds, tx)
  }
}
