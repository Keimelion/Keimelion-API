import { eq, inArray } from 'drizzle-orm'
import { db } from '../../client.js'
import { listCollaborators } from '../list-collaborators/list-collaborators.schema.js'
import type { Item } from './items.schema.js'
import type { ItemSource } from '../item-sources/item-sources.schema.js'
import type { ListItem } from '../list-items/list-items.schema.js'

export async function findItemsByCreator(userId: string): Promise<Item[]> {
  return db.query.items.findMany({
    where: (table, { and, isNull }) => and(eq(table.createdByUserId, userId), isNull(table.deletedAt)),
  })
}

export async function findItemSourcesByCreator(userId: string): Promise<ItemSource[]> {
  const userItems = await db.query.items.findMany({
    where: (table, { eq: eqFn }) => eqFn(table.createdByUserId, userId),
    columns: { id: true },
  })

  if (userItems.length === 0) return []

  const itemIds = userItems.map((item) => item.id)
  return db.query.itemSources.findMany({
    where: (table) => inArray(table.itemId, itemIds),
  })
}

export async function findListItemsByUser(userId: string): Promise<ListItem[]> {
  const collaborations = await db.query.listCollaborators.findMany({
    where: (table, { eq: eqFn }) => eqFn(table.userId, userId),
    columns: { listId: true },
  })

  if (collaborations.length === 0) return []

  const listIds = collaborations.map((collab) => collab.listId)
  return db.query.listItems.findMany({
    where: (table) => inArray(table.listId, listIds),
  })
}

export async function findListCollaboratorsByUser(userId: string): Promise<{ listId: string }[]> {
  return db
    .select({ listId: listCollaborators.listId })
    .from(listCollaborators)
    .where(eq(listCollaborators.userId, userId))
}
