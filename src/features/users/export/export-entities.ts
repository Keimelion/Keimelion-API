import { findUserById } from '../../../db/entities/users/users.repository.js'
import {
  findFeedbackByUser,
  findImagesByUploaderForExport,
  findItemsByCreator,
  findItemSourcesByCreator,
  findListItemsForContributor,
  findListsOwnedByForExport,
  findListTagsForOwner,
  findTagsCreatedByUser,
} from './rgpd-export.repository.js'
import { toUserDetail } from '../../../shared/types/user.js'
import { toFeedbackDetail } from '../../../shared/types/feedback.js'
import { toItemDetail, toItemSourceDetailWithoutShop, toListItemDetail } from '../../../shared/types/item.js'
import { toListDetail } from '../../../shared/types/list.js'
import { toTagDetail } from '../../../shared/types/tag.js'
import { toImageDetail } from '../../uploads/images.mapper.js'
import type { List } from '../../../db/entities/lists/lists.schema.js'
import type { ListTag } from '../../../db/entities/list-tags/list-tags.schema.js'
import type { ListDetail } from '../../../shared/types/list.js'

export interface ExportListTagRow {
  listId: string
  tagId: string
  assignedAt: Date
}

export function toExportListTagRow(row: ListTag): ExportListTagRow {
  return { listId: row.listId, tagId: row.tagId, assignedAt: row.assignedAt }
}

export interface ExportListRow extends ListDetail {
  deletedAt: Date | null
}

export function toExportListRow(list: List): ExportListRow {
  const row = { ...list, collaborators: [], listTags: [] }
  return { ...toListDetail(row, null), deletedAt: list.deletedAt }
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
    'defaultCurrency',
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
    'imageId',
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

const listTagsEntityDescriptor: ExportEntityDescriptor = {
  filename: 'list-tags.csv',
  columns: ['listId', 'tagId', 'assignedAt'],
  fetchRows: async (userId: string) => {
    const rows = await findListTagsForOwner(userId)
    return rows.map(toExportListTagRow)
  },
}

const feedbackEntityDescriptor: ExportEntityDescriptor = {
  filename: 'feedback.csv',
  columns: [
    'id',
    'title',
    'description',
    'context',
    'status',
    'createdAt',
    'updatedAt',
  ],
  fetchRows: async (userId: string) => {
    const rows = await findFeedbackByUser(userId)
    return rows.map(toFeedbackDetail)
  },
}

const imagesEntityDescriptor: ExportEntityDescriptor = {
  filename: 'images.csv',
  columns: [
    'id',
    'hash',
    'mime',
    'sizeBytes',
    'width',
    'height',
    'createdAt',
    'urls',
  ],
  fetchRows: async (userId: string) => {
    const rows = await findImagesByUploaderForExport(userId)
    return rows.map((image) => {
      const detail = toImageDetail(image)
      return { ...detail, urls: JSON.stringify(detail.urls) }
    })
  },
}

export const EXPORT_ENTITY_REGISTRY: ExportEntityDescriptor[] = [
  profileEntityDescriptor,
  itemsEntityDescriptor,
  itemSourcesEntityDescriptor,
  listItemsEntityDescriptor,
  listsEntityDescriptor,
  tagsEntityDescriptor,
  listTagsEntityDescriptor,
  feedbackEntityDescriptor,
  imagesEntityDescriptor,
]
