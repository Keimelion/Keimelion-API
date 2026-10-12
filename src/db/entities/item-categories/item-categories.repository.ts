import { eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { itemCategories } from './item-categories.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbClient = typeof db | DbTransaction

export async function replaceItemCategories(
  itemId: string,
  categoryIds: string[],
  client: DbClient = db,
): Promise<void> {
  const run = async (tx: DbClient): Promise<void> => {
    await tx.delete(itemCategories).where(eq(itemCategories.itemId, itemId))
    if (categoryIds.length === 0) return
    await tx.insert(itemCategories).values(
      categoryIds.map((categoryId) => ({ itemId, categoryId })),
    )
  }
  if (client === db) {
    await db.transaction(run)
    return
  }
  await run(client)
}
