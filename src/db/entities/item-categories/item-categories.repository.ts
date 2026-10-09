import { eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { itemCategories } from './item-categories.schema.js'
import type { ItemCategory } from './item-categories.schema.js'
import type { Category } from '../categories/categories.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbClient = typeof db | DbTransaction

export interface ItemCategoryWithCategory extends ItemCategory {
  category: Category
}

export async function deleteItemCategoriesForItem(
  itemId: string,
  client: DbClient = db,
): Promise<void> {
  await client.delete(itemCategories).where(eq(itemCategories.itemId, itemId))
}

export async function insertItemCategories(
  itemId: string,
  categoryIds: string[],
  client: DbClient = db,
): Promise<void> {
  if (categoryIds.length === 0) return
  await client.insert(itemCategories).values(
    categoryIds.map((categoryId) => ({ itemId, categoryId })),
  )
}

export async function replaceItemCategories(
  itemId: string,
  categoryIds: string[],
): Promise<ItemCategoryWithCategory[]> {
  return db.transaction(async (tx) => {
    await deleteItemCategoriesForItem(itemId, tx)
    await insertItemCategories(itemId, categoryIds, tx)
    return tx.query.itemCategories.findMany({
      where: eq(itemCategories.itemId, itemId),
      with: { category: true },
    })
  })
}

