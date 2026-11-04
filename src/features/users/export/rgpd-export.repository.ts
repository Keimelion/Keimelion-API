import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { feedback } from '../../../db/entities/feedback/feedback.schema.js'
import { images } from '../../../db/entities/images/images.schema.js'
import { items } from '../../../db/entities/items/items.schema.js'
import { itemSources } from '../../../db/entities/item-sources/item-sources.schema.js'
import { listUsers } from '../../../db/entities/list-users/list-users.schema.js'
import { listInvites } from '../../../db/entities/list-invites/list-invites.schema.js'
import { listItems } from '../../../db/entities/list-items/list-items.schema.js'
import { listTags } from '../../../db/entities/list-tags/list-tags.schema.js'
import { lists } from '../../../db/entities/lists/lists.schema.js'
import { reservations } from '../../../db/entities/reservations/reservations.schema.js'
import { tags } from '../../../db/entities/tags/tags.schema.js'
import { users } from '../../../db/entities/users/users.schema.js'
import { CONTRIBUTOR_ROLE_VALUES, ListUserRoles } from '../../../shared/enums/list-user-role.js'
import type { Feedback } from '../../../db/entities/feedback/feedback.schema.js'
import type { Image } from '../../../db/entities/images/images.schema.js'
import type { ItemRowWithImage } from '../../../shared/types/item.js'
import type { ItemSource } from '../../../db/entities/item-sources/item-sources.schema.js'
import type { ListUser } from '../../../db/entities/list-users/list-users.schema.js'
import type { ListInvite } from '../../../db/entities/list-invites/list-invites.schema.js'
import type { ListItem } from '../../../db/entities/list-items/list-items.schema.js'
import type { ListTag } from '../../../db/entities/list-tags/list-tags.schema.js'
import type { List } from '../../../db/entities/lists/lists.schema.js'
import type { Tag } from '../../../db/entities/tags/tags.schema.js'

export async function findItemsByCreator(userId: string): Promise<ItemRowWithImage[]> {
  return db.query.items.findMany({
    where: eq(items.createdByUserId, userId),
    with: { image: true },
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
    .select({ id: listUsers.listId })
    .from(listUsers)
    .where(and(
      eq(listUsers.userId, userId),
      inArray(listUsers.role, [...CONTRIBUTOR_ROLE_VALUES]),
    ))
  return db.query.listItems.findMany({
    where: inArray(listItems.listId, contributorListIds),
  })
}

function ownedListIds(userId: string) {
  return db
    .select({ id: listUsers.listId })
    .from(listUsers)
    .where(and(eq(listUsers.userId, userId), eq(listUsers.role, ListUserRoles.OWNER)))
}

export async function findListsOwnedByForExport(userId: string): Promise<List[]> {
  return db.query.lists.findMany({
    where: inArray(lists.id, ownedListIds(userId)),
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
  return db.query.listTags.findMany({
    where: inArray(listTags.listId, ownedListIds(userId)),
  })
}

// Memberships on the user's own lists + the user's memberships on other people's lists.
export async function findListUsersForExport(userId: string): Promise<ListUser[]> {
  return db.query.listUsers.findMany({
    where: or(inArray(listUsers.listId, ownedListIds(userId)), eq(listUsers.userId, userId)),
  })
}

// Invites sent on the user's lists + invites the user received (by email) or accepted.
export async function findListInvitesForExport(userId: string): Promise<ListInvite[]> {
  // Built with the query builder (not a raw sql template): the relational API would rewrite
  // `users.*` columns of a raw template to the outer `listInvites` alias.
  const userEmail = db
    .select({ email: sql<string>`lower(${users.email})` })
    .from(users)
    .where(eq(users.id, userId))
  return db.query.listInvites.findMany({
    where: or(
      inArray(listInvites.listId, ownedListIds(userId)),
      eq(listInvites.acceptedByUserId, userId),
      inArray(listInvites.invitedEmail, userEmail),
    ),
  })
}

export interface ReservationExportRow {
  reservationId: string
  listItemId: string
  listTitle: string
  itemName: string
  quantityBooked: number
  createdAt: Date
}

export async function findReservationsForExport(userId: string): Promise<ReservationExportRow[]> {
  const rows = await db.query.reservations.findMany({
    where: eq(reservations.userId, userId),
    orderBy: desc(reservations.createdAt),
    with: {
      listItem: {
        with: {
          list: { columns: { title: true } },
          item: { columns: { name: true } },
        },
      },
    },
  })

  return rows.map((row) => ({
    reservationId: row.id,
    listItemId: row.listItemId,
    listTitle: row.listItem.list.title,
    itemName: row.listItem.item.name,
    quantityBooked: row.quantityBooked,
    createdAt: row.createdAt,
  }))
}
