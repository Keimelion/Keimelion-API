import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../../client.js'
import { CollabRoles } from '../../../shared/enums/collab-role.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { listCollaborators } from '../list-collaborators/list-collaborators.schema.js'
import { listItems } from '../list-items/list-items.schema.js'
import { lists } from './lists.schema.js'
import type { ListStatus } from '../../../shared/enums/list-status.js'
import type { ListRowWithOwner, PublicListRow } from '../../../shared/types/list.js'
import type { List } from './lists.schema.js'

export const LIST_WITH_OWNER = {
  collaborators: {
    where: eq(listCollaborators.collabRole, CollabRoles.OWNER),
    limit: 1,
    with: { user: true },
  },
  listTags: {
    with: { tag: true },
  },
} as const

export const LIST_SORTABLE_FIELDS = {
  createdAt:  lists.createdAt,
  updatedAt:  lists.updatedAt,
  title:      lists.title,
  listStatus: lists.listStatus,
} as const

export const LIST_DEFAULT_SORT = [{ field: 'createdAt' as const, direction: 'desc' as const }]

interface FindListByIdOptions {
  includeDeleted?: boolean
}

interface FindListWithOwnerOptions {
  excludeDeleted?: boolean
}

export async function findListWithOwner(
  id: string,
  options: FindListWithOwnerOptions = {},
): Promise<ListRowWithOwner | undefined> {
  const row = await db.query.lists.findFirst({
    where: eq(lists.id, id),
    with: LIST_WITH_OWNER,
  })
  if (!row) return undefined
  if (options.excludeDeleted && row.deletedAt !== null) return undefined
  return row
}

interface FindListBySlugOptions {
  excludeDeleted: boolean
}

export function findListBySlug(
  slug: string,
  options: FindListBySlugOptions,
): Promise<PublicListRow | undefined> {
  const where = options.excludeDeleted
    ? and(eq(lists.slug, slug), isNull(lists.deletedAt))
    : eq(lists.slug, slug)
  return db.query.lists.findFirst({
    where,
    with: {
      collaborators: {
        where: eq(listCollaborators.collabRole, CollabRoles.OWNER),
        limit: 1,
        with: { user: { with: { avatarImage: true } } },
      },
      listTags: {
        with: { tag: true },
      },
      listItems: {
        orderBy: [sql`${listItems.sortOrder} ASC NULLS LAST`, asc(listItems.createdAt)],
        with: {
          image: true,
          item: {
            with: {
              sources: { with: { shop: true } },
              itemCategories: { with: { category: { with: { translations: true } } } },
              itemTags: { with: { tag: true } },
            },
          },
        },
      },
    },
  }) as Promise<PublicListRow | undefined>
}

export type InsertList = Pick<
  typeof lists.$inferInsert,
  'title' | 'slug' | 'description' | 'listStatus' | 'occasionTypeId'
>

export type UpdateListFields = Partial<
  Pick<
    typeof lists.$inferInsert,
    'title' | 'description' | 'listStatus' | 'occasionTypeId'
  >
>

interface ListUpdateInputFields {
  title?: string | undefined
  description?: string | null | undefined
  occasionTypeId?: string | null | undefined
  listStatus?: ListStatus | undefined
}

export function buildListUpdatePatch(input: ListUpdateInputFields): UpdateListFields {
  return pickDefined({
    title: input.title,
    description: input.description,
    occasionTypeId: input.occasionTypeId,
    listStatus: input.listStatus,
  })
}

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export function findListById(id: string, options?: FindListByIdOptions): Promise<List | undefined> {
  const includeDeleted = options?.includeDeleted ?? false
  const where = includeDeleted ? eq(lists.id, id) : and(eq(lists.id, id), isNull(lists.deletedAt))
  return db.query.lists.findFirst({ where })
}

export async function insertList(data: InsertList, tx?: DbOrTx): Promise<List | undefined> {
  const executor = tx ?? db
  const [row] = await executor.insert(lists).values(data).returning()
  return row
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbClient = typeof db | DbTransaction

export async function updateList(
  id: string,
  fields: UpdateListFields,
  client: DbClient = db,
): Promise<List | undefined> {
  const [row] = await client.update(lists).set(fields).where(eq(lists.id, id)).returning()
  return row
}

export async function softDeleteList(id: string): Promise<List | undefined> {
  const [row] = await db
    .update(lists)
    .set({ deletedAt: new Date() })
    .where(eq(lists.id, id))
    .returning()
  return row
}

export async function restoreList(id: string): Promise<List | undefined> {
  const [row] = await db
    .update(lists)
    .set({ deletedAt: null })
    .where(eq(lists.id, id))
    .returning()
  return row
}
