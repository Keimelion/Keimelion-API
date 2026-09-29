import { sql } from 'drizzle-orm'
import type { db as Db } from '../client.js'
import { items } from '../entities/items/items.schema.js'
import { itemSources } from '../entities/item-sources/item-sources.schema.js'

/**
 * Removes any items that have no rows in item_sources. Dev-only helper so
 * legacy sourceless items from before the "items must have >=1 source"
 * invariant do not break the seed pipeline.
 */
export async function cleanupSourcelessItems(db: typeof Db): Promise<void> {
  const deleted = await db
    .delete(items)
    .where(sql`NOT EXISTS (SELECT 1 FROM ${itemSources} WHERE ${itemSources.itemId} = ${items.id})`)
    .returning({ id: items.id })

  if (deleted.length > 0) {
    console.log(`  cleanup      ${String(deleted.length)} sourceless items removed`)
  }
}

/**
 * Fails loudly if any item still has zero rows in item_sources after seeding.
 * Enforces the "items must have >=1 source" invariant end-to-end.
 */
export async function assertItemsHaveSources(db: typeof Db): Promise<void> {
  const orphans = await db
    .select({ id: items.id })
    .from(items)
    .where(sql`NOT EXISTS (SELECT 1 FROM ${itemSources} WHERE ${itemSources.itemId} = ${items.id})`)

  if (orphans.length === 0) return

  const ids = orphans.map((row) => row.id).join(', ')
  throw new Error(`Seed invariant broken: items without any source: ${ids}`)
}
