import { eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { listItems } from './list-items.schema.js'
import type { ListItem } from './list-items.schema.js'

interface InsertListItemInput {
  listId: string
  itemId: string
  quantityDesired: number
  creatorNote: string | null
  itemStatus: string
}

type UpdateListItemFields = Partial<Pick<typeof listItems.$inferInsert, 'quantityDesired' | 'creatorNote' | 'sortOrder'>>

export async function insertListItem(input: InsertListItemInput): Promise<ListItem | undefined> {
  const [listItem] = await db.insert(listItems).values(input).returning()
  return listItem
}

export function findListItemById(id: string): Promise<ListItem | undefined> {
  return db.query.listItems.findFirst({ where: eq(listItems.id, id) })
}

export async function updateListItem(id: string, input: UpdateListItemFields): Promise<ListItem | undefined> {
  const [listItem] = await db.update(listItems).set(input).where(eq(listItems.id, id)).returning()
  return listItem
}

export async function deleteListItem(id: string): Promise<ListItem | undefined> {
  const [listItem] = await db.delete(listItems).where(eq(listItems.id, id)).returning()
  return listItem
}
