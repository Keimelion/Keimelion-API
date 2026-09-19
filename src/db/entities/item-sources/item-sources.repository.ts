import { db } from '../../client.js'
import { itemSources } from './item-sources.schema.js'
import type { ItemSource } from './item-sources.schema.js'

interface InsertItemSourceInput {
  itemId: string
  shopName: string | null
  sourceUrl: string | null
  price: string | null
  currency: string
  isPrimary: boolean
  addedVia: string | null
}

export async function insertItemSource(input: InsertItemSourceInput): Promise<ItemSource | undefined> {
  const [source] = await db.insert(itemSources).values(input).returning()
  return source
}
