import { eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { items } from './items.schema.js'
import type { Item } from './items.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface InsertItemInput {
  name: string
  description: string | null
  imageUrl: string | null
  locale: string
  createdByUserId: string | null
  moderationStatus: string
}

export async function insertItem(input: InsertItemInput, tx?: DbTransaction): Promise<Item | undefined> {
  const client = tx ?? db
  const [item] = await client.insert(items).values(input).returning()
  return item
}

export function findItemById(id: string): Promise<Item | undefined> {
  return db.query.items.findFirst({ where: eq(items.id, id) })
}
