import { findUserById } from '../../../db/entities/users/users.repository.js'
import {
  findFeedbackByUser,
  findImagesByUploaderForExport,
  findItemsByCreator,
  findItemSourcesByCreator,
  findListInvitesForExport,
  findListItemsForContributor,
  findListsOwnedByForExport,
  findListTagsForOwner,
  findListUsersForExport,
  findReservationsForExport,
  findTagsCreatedByUser,
} from './rgpd-export.repository.js'
import { toUserDetail } from '../../../shared/types/user.js'
import { toFeedbackDetail } from '../../../shared/types/feedback.js'
import { toItemDetail, toItemSourceDetailWithoutShop, toListItemDetail } from '../../../shared/types/item.js'
import { toListDetail } from '../../../shared/types/list.js'
import { toTagDetail } from '../../../shared/types/tag.js'
import { toImageDetail } from '../../uploads/images.mapper.js'
import type { List } from '../../../db/entities/lists/lists.schema.js'
import type { ListInvite } from '../../../db/entities/list-invites/list-invites.schema.js'
import type { ListUser } from '../../../db/entities/list-users/list-users.schema.js'
import type { ListTag } from '../../../db/entities/list-tags/list-tags.schema.js'
import type { ListDetail } from '../../../shared/types/list.js'
import type { ListUserRole } from '../../../shared/enums/list-user-role.js'
import type { InviteStatus } from '../../../shared/enums/invite-status.js'

export interface ExportListTagRow {
  listId: string
  tagId: string
  assignedAt: Date
}

export function toExportListTagRow(row: ListTag): ExportListTagRow {
  return { listId: row.listId, tagId: row.tagId, assignedAt: row.assignedAt }
}

export interface ExportListUserRow {
  listId: string
  role: ListUserRole
  createdAt: Date
  updatedAt: Date
}

export function toExportListUserRow(row: ListUser): ExportListUserRow {
  return {
    listId: row.listId,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export interface ExportListInviteRow {
  listId: string
  invitedEmail: string
  role: ListUserRole
  inviteStatus: InviteStatus
  acceptedAt: Date | null
  createdAt: Date
}

export function toExportListInviteRow(row: ListInvite): ExportListInviteRow {
  return {
    listId: row.listId,
    invitedEmail: row.invitedEmail,
    role: row.role,
    inviteStatus: row.inviteStatus,
    acceptedAt: row.acceptedAt ?? null,
    createdAt: row.createdAt,
  }
}

export interface ExportListRow extends ListDetail {
  deletedAt: Date | null
}

export function toExportListRow(list: List): ExportListRow {
  const row = { ...list, listUsers: [], listTags: [] }
  return { ...toListDetail(row), deletedAt: list.deletedAt }
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
    'imageId',
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

const listTagsEntityDescriptor: ExportEntityDescriptor = {
  filename: 'list-tags.csv',
  columns: ['listId', 'tagId', 'assignedAt'],
  fetchRows: async (userId: string) => {
    const rows = await findListTagsForOwner(userId)
    return rows.map(toExportListTagRow)
  },
}

const listUsersEntityDescriptor: ExportEntityDescriptor = {
  filename: 'list-users.csv',
  columns: ['listId', 'role', 'createdAt', 'updatedAt'],
  fetchRows: async (userId: string) => {
    const rows = await findListUsersForExport(userId)
    return rows.map(toExportListUserRow)
  },
}

const listInvitesEntityDescriptor: ExportEntityDescriptor = {
  filename: 'list-invites.csv',
  columns: [
    'listId',
    'invitedEmail',
    'role',
    'inviteStatus',
    'acceptedAt',
    'createdAt',
  ],
  fetchRows: async (userId: string) => {
    const rows = await findListInvitesForExport(userId)
    return rows.map(toExportListInviteRow)
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

const reservationsEntityDescriptor: ExportEntityDescriptor = {
  filename: 'my_reservations.csv',
  columns: [
    'reservationId',
    'listItemId',
    'listTitle',
    'itemName',
    'quantityBooked',
    'createdAt',
  ],
  fetchRows: async (userId: string) => findReservationsForExport(userId),
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
    'urlSm',
    'urlMd',
    'urlLg',
  ],
  fetchRows: async (userId: string) => {
    const rows = await findImagesByUploaderForExport(userId)
    return rows.map((image) => {
      const { urls, ...rest } = toImageDetail(image)
      return { ...rest, urlSm: urls.sm, urlMd: urls.md, urlLg: urls.lg }
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
  listUsersEntityDescriptor,
  listInvitesEntityDescriptor,
  feedbackEntityDescriptor,
  reservationsEntityDescriptor,
  imagesEntityDescriptor,
]
