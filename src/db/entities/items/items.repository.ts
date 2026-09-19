import { eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { items } from './items.schema.js'
import type { Item } from './items.schema.js'

interface InsertItemInput {
  name: string
  description: string | null
  imageUrl: string | null
  locale: string
  createdByUserId: string | null
  moderationStatus: string
}

export async function insertItem(input: InsertItemInput): Promise<Item | undefined> {
  const [item] = await db.insert(items).values(input).returning()
  return item
}

export function findItemById(id: string): Promise<Item | undefined> {
  return db.query.items.findFirst({ where: eq(items.id, id) })
}
