import { db } from '../../client.js'
import { itemSources } from './item-sources.schema.js'
import type { ItemSource } from './item-sources.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface InsertItemSourceInput {
  itemId: string
  shopName: string | null
  sourceUrl: string | null
  price: string | null
  currency: string
  isPrimary: boolean
  addedVia: string | null
}

export async function insertItemSource(input: InsertItemSourceInput, tx?: DbTransaction): Promise<ItemSource | undefined> {
  const client = tx ?? db
  const [source] = await client.insert(itemSources).values(input).returning()
  return source
}
