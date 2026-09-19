import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { items } from '../../../db/entities/items/items.schema.js'
import { itemSources } from '../../../db/entities/item-sources/item-sources.schema.js'
import { listCollaborators } from '../../../db/entities/list-collaborators/list-collaborators.schema.js'
import { listItems } from '../../../db/entities/list-items/list-items.schema.js'
import { CONTRIBUTOR_ROLE_VALUES } from '../../../shared/enums/collab-role.js'
import type { Item } from '../../../db/entities/items/items.schema.js'
import type { ItemSource } from '../../../db/entities/item-sources/item-sources.schema.js'
import type { ListItem } from '../../../db/entities/list-items/list-items.schema.js'

export async function findItemsByCreator(userId: string): Promise<Item[]> {
  return db.query.items.findMany({
    where: and(eq(items.createdByUserId, userId), isNull(items.deletedAt)),
  })
}

export async function findItemSourcesByCreator(userId: string): Promise<ItemSource[]> {
  const userItems = await db.query.items.findMany({
    where: eq(items.createdByUserId, userId),
    columns: { id: true },
  })

  if (userItems.length === 0) return []

  const itemIds = userItems.map((item) => item.id)
  return db.query.itemSources.findMany({
    where: inArray(itemSources.itemId, itemIds),
  })
}

export async function findListItemsForContributor(userId: string): Promise<ListItem[]> {
  const contributions = await db.query.listCollaborators.findMany({
    where: and(
      eq(listCollaborators.userId, userId),
      inArray(listCollaborators.collabRole, [...CONTRIBUTOR_ROLE_VALUES]),
    ),
    columns: { listId: true },
  })

  if (contributions.length === 0) return []

  const listIds = contributions.map((collab) => collab.listId)
  return db.query.listItems.findMany({
    where: inArray(listItems.listId, listIds),
  })
}
