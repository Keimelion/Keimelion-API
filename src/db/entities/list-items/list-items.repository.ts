import { eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { ListUserRoles } from '@keimelion/sdk/enums'
import type { ItemStatus } from '@keimelion/sdk/enums'
import { listUsers } from '../list-users/list-users.schema.js'
import { listItems } from './list-items.schema.js'
import type { ListItem } from './list-items.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbOrTx = typeof db | DbTransaction

interface InsertListItemInput {
  listId: string
  itemId: string
  quantityDesired: number
  creatorNote: string | null
  itemStatus: ItemStatus
}

type UpdateListItemFields = Partial<Pick<typeof listItems.$inferInsert, 'quantityDesired' | 'creatorNote' | 'sortOrder'>>

interface UpdateReservationStateInput {
  quantityReservedTotal: number
  itemStatus: ItemStatus
}

export async function insertListItem(input: InsertListItemInput, tx?: DbTransaction): Promise<ListItem | undefined> {
  const client = tx ?? db
  const [listItem] = await client.insert(listItems).values(input).returning()
  return listItem
}

export function findListItemById(id: string): Promise<ListItem | undefined> {
  return db.query.listItems.findFirst({ where: eq(listItems.id, id) })
}

export async function findListItemOwnerUserId(listItemId: string, tx: DbOrTx): Promise<string | null> {
  const row = await tx.query.listItems.findFirst({
    where: eq(listItems.id, listItemId),
    columns: { id: true },
    with: {
      list: {
        columns: { id: true },
        with: {
          listUsers: {
            where: eq(listUsers.role, ListUserRoles.OWNER),
            columns: { userId: true },
            limit: 1,
          },
        },
      },
    },
  })
  return row?.list.listUsers[0]?.userId ?? null
}

export async function findListItemByIdForUpdate(id: string, tx: DbOrTx): Promise<ListItem | undefined> {
  const [row] = await tx.select().from(listItems).where(eq(listItems.id, id)).for('update')
  return row
}

export async function updateListItem(id: string, input: UpdateListItemFields): Promise<ListItem | undefined> {
  const [listItem] = await db.update(listItems).set(input).where(eq(listItems.id, id)).returning()
  return listItem
}

export async function updateListItemReservationState(
  id: string,
  input: UpdateReservationStateInput,
  tx: DbOrTx,
): Promise<ListItem | undefined> {
  const [row] = await tx.update(listItems).set(input).where(eq(listItems.id, id)).returning()
  return row
}

export async function deleteListItem(id: string): Promise<ListItem | undefined> {
  const [listItem] = await db.delete(listItems).where(eq(listItems.id, id)).returning()
  return listItem
}
