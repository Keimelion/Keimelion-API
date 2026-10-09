import { findUserById } from '../../../db/entities/users/users.repository.js'
import {
  findItemsByCreator,
  findItemSourcesByCreator,
  findListItemsForContributor,
  findListsOwnedByForExport,
  findTagsCreatedByUser,
} from './rgpd-export.repository.js'
import { toUserDetail } from '../../../shared/types/user.js'
import { toItemDetail, toItemSourceDetailWithoutShop, toListItemDetail } from '../../../shared/types/item.js'
import { toListDetail } from '../../../shared/types/list.js'
import { toTagDetail } from '../../../shared/types/tag.js'
import type { List } from '../../../db/entities/lists/lists.schema.js'
import type { ListDetail } from '../../../shared/types/list.js'

export interface ExportListRow extends ListDetail {
  deletedAt: Date | null
}

export function toExportListRow(list: List): ExportListRow {
  return { ...toListDetail(list, null), deletedAt: list.deletedAt }
}

/**
 * Descriptor for a single entity exported in the RGPD CSV archive.
 *
 * Extensibility contract (RGPD art. 20 — right to portability):
 * Adding a new user-linked table (direct FK `user_id` OR transitive, e.g.
 * `list_items` → `lists` → `users`) to the export requires exactly:
 *   1. Define a new `ExportEntityDescriptor` with:
 *      - `filename`: unique CSV filename inside the ZIP (e.g. `lists.csv`)
 *      - `columns`: explicit allow-list of column headers (NEVER spread a DB
 *        row — this guarantees no sensitive column leaks by accident)
 *      - `fetchRows`: async function that resolves to plain rows scoped to
 *        the given `userId`
 *   2. Append the descriptor to `EXPORT_ENTITY_REGISTRY` below
 *
 * Security invariants (do NOT relax):
 *   - Row mappers MUST filter sensitive fields (passwordHash, verify/reset
 *     tokens, refresh secrets, banReason, deletion audit internals…). Prefer
 *     going through a `toBaseX` mapper that already strips them.
 *   - `columns` is an allow-list — any key present in a row but absent from
 *     `columns` is silently dropped by csv-stringify.
 *   - Anti-formula-injection is enforced globally by `escape_formulas: true`
 *     in `csv-archive-writer.ts` — do NOT disable it per entity.
 */
export interface ExportEntityDescriptor {
  filename: string
  columns: string[]
  fetchRows: (userId: string) => Promise<object[]>
}

const profileEntityDescriptor: ExportEntityDescriptor = {
  filename: 'profile.csv',
  columns: [
    'id',
    'email',
    'username',
    'authProvider',
    'role',
    'avatarUrl',
    'isCgvAccepted',
    'cgvAcceptedAt',
    'isMarketingOptedIn',
    'emailVerifiedAt',
    'lastActiveAt',
    'createdAt',
    'updatedAt',
  ],
  fetchRows: async (userId: string) => {
    const user = await findUserById(userId)
    if (!user) return []
    return [toUserDetail(user)]
  },
}

const itemsEntityDescriptor: ExportEntityDescriptor = {
  filename: 'items.csv',
  columns: [
    'id',
    'name',
    'description',
    'imageUrl',
    'createdAt',
    'updatedAt',
  ],
  fetchRows: async (userId: string) => {
    const userItems = await findItemsByCreator(userId)
    return userItems.map((item) => toItemDetail(item))
  },
}

const itemSourcesEntityDescriptor: ExportEntityDescriptor = {
  filename: 'item-sources.csv',
  columns: [
    'id',
    'itemId',
    'shopId',
    'sourceUrl',
    'price',
    'currency',
    'createdAt',
    'updatedAt',
  ],
  fetchRows: async (userId: string) => {
    const sources = await findItemSourcesByCreator(userId)
    return sources.map(toItemSourceDetailWithoutShop)
  },
}

const listItemsEntityDescriptor: ExportEntityDescriptor = {
  filename: 'list-items.csv',
  columns: [
    'id',
    'listId',
    'itemId',
    'quantityDesired',
    'quantityReservedTotal',
    'itemStatus',
    'sortOrder',
    'creatorNote',
    'createdAt',
    'updatedAt',
  ],
  fetchRows: async (userId: string) => {
    const userListItems = await findListItemsForContributor(userId)
    return userListItems.map((listItem) => toListItemDetail(listItem))
  },
}

const listsEntityDescriptor: ExportEntityDescriptor = {
  filename: 'lists.csv',
  columns: [
    'id',
    'title',
    'slug',
    'description',
    'listStatus',
    'occasionTypeId',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  fetchRows: async (userId: string) => {
    const ownedLists = await findListsOwnedByForExport(userId)
    return ownedLists.map(toExportListRow)
  },
}

const tagsEntityDescriptor: ExportEntityDescriptor = {
  filename: 'tags.csv',
  columns: [
    'id',
    'name',
    'slug',
    'createdAt',
  ],
  fetchRows: async (userId: string) => {
    const createdTags = await findTagsCreatedByUser(userId)
    return createdTags.map(toTagDetail)
  },
}

export const EXPORT_ENTITY_REGISTRY: ExportEntityDescriptor[] = [
  profileEntityDescriptor,
  itemsEntityDescriptor,
  itemSourcesEntityDescriptor,
  listItemsEntityDescriptor,
  listsEntityDescriptor,
  tagsEntityDescriptor,
]
