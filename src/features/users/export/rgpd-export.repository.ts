import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { feedback } from '../../../db/entities/feedback/feedback.schema.js'
import { images } from '../../../db/entities/images/images.schema.js'
import { items } from '../../../db/entities/items/items.schema.js'
import { itemSources } from '../../../db/entities/item-sources/item-sources.schema.js'
import { listCollaborators } from '../../../db/entities/list-collaborators/list-collaborators.schema.js'
import { listItems } from '../../../db/entities/list-items/list-items.schema.js'
import { listTags } from '../../../db/entities/list-tags/list-tags.schema.js'
import { lists } from '../../../db/entities/lists/lists.schema.js'
import { tags } from '../../../db/entities/tags/tags.schema.js'
import { CollabRoles, CONTRIBUTOR_ROLE_VALUES } from '../../../shared/enums/collab-role.js'
import type { Feedback } from '../../../db/entities/feedback/feedback.schema.js'
import type { Image } from '../../../db/entities/images/images.schema.js'
import type { Item } from '../../../db/entities/items/items.schema.js'
import type { ItemSource } from '../../../db/entities/item-sources/item-sources.schema.js'
import type { ListItem } from '../../../db/entities/list-items/list-items.schema.js'
import type { ListTag } from '../../../db/entities/list-tags/list-tags.schema.js'
import type { List } from '../../../db/entities/lists/lists.schema.js'
import type { Tag } from '../../../db/entities/tags/tags.schema.js'

export async function findItemsByCreator(userId: string): Promise<Item[]> {
  return db.query.items.findMany({
    where: eq(items.createdByUserId, userId),
  })
}

export async function findItemSourcesByCreator(userId: string): Promise<ItemSource[]> {
  const userItemIds = db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.createdByUserId, userId))
  return db.query.itemSources.findMany({
    where: inArray(itemSources.itemId, userItemIds),
  })
}

export async function findListItemsForContributor(userId: string): Promise<ListItem[]> {
  const contributorListIds = db
    .select({ id: listCollaborators.listId })
    .from(listCollaborators)
    .where(and(
      eq(listCollaborators.userId, userId),
      inArray(listCollaborators.collabRole, [...CONTRIBUTOR_ROLE_VALUES]),
    ))
  return db.query.listItems.findMany({
    where: inArray(listItems.listId, contributorListIds),
  })
}

export async function findListsOwnedByForExport(userId: string): Promise<List[]> {
  const ownedListIds = db
    .select({ id: listCollaborators.listId })
    .from(listCollaborators)
    .where(and(eq(listCollaborators.userId, userId), eq(listCollaborators.collabRole, CollabRoles.OWNER)))
  return db.query.lists.findMany({
    where: inArray(lists.id, ownedListIds),
  })
}

export async function findTagsCreatedByUser(userId: string): Promise<Tag[]> {
  return db.query.tags.findMany({
    where: eq(tags.createdByUserId, userId),
  })
}

export async function findFeedbackByUser(userId: string): Promise<Feedback[]> {
  return db.query.feedback.findMany({
    where: eq(feedback.userId, userId),
  })
}

export async function findImagesByUploaderForExport(userId: string): Promise<Image[]> {
  return db.query.images.findMany({
    where: eq(images.uploadedBy, userId),
  })
}

export async function findListTagsForOwner(userId: string): Promise<ListTag[]> {
  const ownedListIds = db
    .select({ id: listCollaborators.listId })
    .from(listCollaborators)
    .where(and(eq(listCollaborators.userId, userId), eq(listCollaborators.collabRole, CollabRoles.OWNER)))
  return db.query.listTags.findMany({
    where: inArray(listTags.listId, ownedListIds),
  })
}
