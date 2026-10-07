import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { ItemStatuses } from '../../shared/enums/item-status.js'
import { ListStatuses } from '../../shared/enums/list-status.js'
import { CollabRoles } from '../../shared/enums/collab-role.js'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import { runWrite } from '../../shared/utils/admin-write.js'
import { buildPaginatedResponse } from '../../shared/schemas/pagination.js'
import { buildSlugFromTitle } from '../../shared/utils/slug.js'
import { isPgUniqueViolation } from '../../shared/db/pg-errors.js'
import { logger } from '../../shared/utils/logger.js'
import { insertItem } from '../../db/entities/items/items.repository.js'
import { insertItemSource } from '../../db/entities/item-sources/item-sources.repository.js'
import { insertListItem } from '../../db/entities/list-items/list-items.repository.js'
import { lists as listsTable } from '../../db/entities/lists/lists.schema.js'
import { listCollaborators } from '../../db/entities/list-collaborators/list-collaborators.schema.js'
import {
  findListById,
  insertList,
  updateList,
  softDeleteList,
} from '../../db/entities/lists/lists.repository.js'
import { insertOwnerCollaborator } from '../../db/entities/list-collaborators/list-collaborators.repository.js'
import { toItemDetail, toListItemDetail, toItemSourceDetail } from '../../shared/types/item.js'
import { toListDetail } from '../../shared/types/list.js'
import { toUserDetail } from '../../shared/types/user.js'
import { findListsOwnedBy, countListsOwnedBy } from './lists.repository.js'
import type { Item } from '../../db/entities/items/items.schema.js'
import type { ItemSource } from '../../db/entities/item-sources/item-sources.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { List } from '../../db/entities/lists/lists.schema.js'
import type { InsertList, UpdateListFields } from '../../db/entities/lists/lists.repository.js'
import type { ListDetail, ListRowWithOwner } from '../../shared/types/list.js'
import type { UserDetail } from '../../shared/types/user.js'
import type { ListItemResponse } from './lists.types.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { PaginatedResponse } from '../../shared/types/api.js'
import type { ItemWrite } from '../../shared/types/item.js'
import type { AddItemInput } from './endpoints/add-item.js'
import type { CreateListInput } from './endpoints/create.js'
import type { ListUserListsInput } from './endpoints/list.js'
import type { UpdateListInput } from './endpoints/update.js'

const DEFAULT_QUANTITY_DESIRED = 1
const DEFAULT_CURRENCY = 'EUR'
const MAX_SLUG_RETRIES = 3

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface CreatedListItemRecord {
  item: Item
  source: ItemSource | null
  listItem: ListItem
}

const LIST_WITH_OWNER_INCLUDE = {
  collaborators: {
    where: eq(listCollaborators.collabRole, CollabRoles.OWNER),
    limit: 1,
    with: { user: true },
  },
} as const

export async function createUserList(
  userId: string,
  input: CreateListInput,
): Promise<ServiceResult<{ list: ListDetail }>> {
  const outcome = await insertListWithSlugRetry(userId, input)
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  return {
    data: { list: toListDetail(outcome.row, mapOwnerFromRow(outcome.row)) },
    httpStatus: HttpStatus.CREATED,
  }
}

export async function listUserLists(
  userId: string,
  input: ListUserListsInput,
): Promise<ServiceResult<PaginatedResponse<ListDetail>>> {
  const [rows, total] = await Promise.all([
    findListsOwnedBy(userId, input, input.sort),
    countListsOwnedBy(userId),
  ])

  const items = rows.map((row) => toListDetail(row, mapOwnerFromRow(row)))
  return {
    data: buildPaginatedResponse(items, input, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function getUserListById(id: string): Promise<ServiceResult<{ list: ListDetail }>> {
  const row = await findListByIdWithOwner(id)
  if (!row || row.deletedAt) return serviceError(ErrorCode.NOT_FOUND)

  return {
    data: { list: toListDetail(row, mapOwnerFromRow(row)) },
    httpStatus: HttpStatus.OK,
  }
}

export async function updateUserList(
  id: string,
  input: UpdateListInput,
): Promise<ServiceResult<{ list: ListDetail }>> {
  const existing = await findListById(id)
  if (!existing || existing.deletedAt) return serviceError(ErrorCode.NOT_FOUND)

  const fieldPatch = buildUpdatePatch(input, existing)
  if (Object.keys(fieldPatch).length === 0) {
    return serviceError(ErrorCode.UNPROCESSABLE_ENTITY, { message: 'At least one field must be provided' })
  }

  const writeOutcome = await runWrite(() => updateList(id, fieldPatch), {
    foreignKeyErrorCode: ErrorCode.UNPROCESSABLE_ENTITY,
  })
  if ('errorCode' in writeOutcome) return serviceError(writeOutcome.errorCode)

  const refreshed = await findListByIdWithOwner(id)
  if (!refreshed) return serviceError(ErrorCode.INTERNAL_ERROR)

  return {
    data: { list: toListDetail(refreshed, mapOwnerFromRow(refreshed)) },
    httpStatus: HttpStatus.OK,
  }
}

export async function deleteUserList(id: string): Promise<ServiceResult<null>> {
  const existing = await findListById(id)
  if (!existing || existing.deletedAt) return serviceError(ErrorCode.NOT_FOUND)

  await softDeleteList(id)
  return { data: null, httpStatus: HttpStatus.NO_CONTENT }
}

export async function addItemToList(
  listId: string,
  userId: string,
  input: AddItemInput,
): Promise<ServiceResult<{ listItem: ListItemResponse }>> {
  const record = await db.transaction((tx) => createManualListItem(tx, listId, userId, input))
  if (!record) return serviceError(ErrorCode.INTERNAL_ERROR)

  return { data: { listItem: buildListItemResponse(record) }, httpStatus: HttpStatus.CREATED }
}

async function insertListWithSlugRetry(
  userId: string,
  input: CreateListInput,
): Promise<{ row: ListRowWithOwner } | { errorCode: ErrorCode }> {
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt += 1) {
    const slug = buildSlugFromTitle(input.title)
    const outcome = await tryInsertList(userId, input, slug)
    if ('row' in outcome) return outcome
    if (outcome.retriable) continue
    return { errorCode: outcome.errorCode }
  }
  return { errorCode: ErrorCode.INTERNAL_ERROR }
}

interface InsertAttemptFailure {
  errorCode: ErrorCode
  retriable: boolean
}

async function tryInsertList(
  userId: string,
  input: CreateListInput,
  slug: string,
): Promise<{ row: ListRowWithOwner } | InsertAttemptFailure> {
  try {
    const created = await db.transaction(async (tx) => {
      const inserted = await insertList(buildCreatePayload(input, slug), tx)
      if (!inserted) throw new Error('List insert returned no row')
      const collaborator = await insertOwnerCollaborator(inserted.id, userId, tx)
      if (!collaborator) throw new Error('Owner collaborator insert returned no row')
      return inserted
    })
    const refreshed = await findListByIdWithOwner(created.id)
    if (!refreshed) return { errorCode: ErrorCode.INTERNAL_ERROR, retriable: false }
    return { row: refreshed }
  } catch (error) {
    if (isPgUniqueViolation(error)) return { errorCode: ErrorCode.CONFLICT, retriable: true }
    logger.error({ error }, 'List creation failed')
    return { errorCode: ErrorCode.INTERNAL_ERROR, retriable: false }
  }
}

function buildCreatePayload(input: CreateListInput, slug: string): InsertList {
  return {
    title: input.title,
    slug,
    description: input.description ?? null,
    occasionTypeId: input.occasionTypeId ?? null,
    eventDate: input.eventDate ?? null,
    listStatus: ListStatuses.ACTIVE,
    isGalleryPublic: false,
    archivedAt: null,
  }
}

function buildUpdatePatch(input: UpdateListInput, existing: List): UpdateListFields {
  const base: UpdateListFields = pickDefined({
    title: input.title,
    description: input.description,
    occasionTypeId: input.occasionTypeId,
    eventDate: input.eventDate,
    listStatus: input.listStatus,
  })

  if (input.listStatus === undefined) return base
  if (input.listStatus === existing.listStatus) return base
  base.archivedAt = input.listStatus === ListStatuses.ARCHIVED ? new Date() : null
  return base
}

async function findListByIdWithOwner(id: string): Promise<ListRowWithOwner | undefined> {
  return db.query.lists.findFirst({
    where: eq(listsTable.id, id),
    with: LIST_WITH_OWNER_INCLUDE,
  })
}

function mapOwnerFromRow(row: ListRowWithOwner): UserDetail | null {
  const owner = row.collaborators[0]?.user ?? null
  return owner ? toUserDetail(owner) : null
}

async function createManualListItem(
  tx: DbTransaction,
  listId: string,
  userId: string,
  input: AddItemInput,
): Promise<CreatedListItemRecord | null> {
  const itemWrite: ItemWrite = {
    name: input.name,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
  }
  const item = await insertItem({
    ...itemWrite,
    createdByUserId: userId,
  }, tx)
  if (!item) return null

  const source = input.price === undefined ? null : (await insertItemSource({
    itemId: item.id,
    sourceUrl: null,
    price: String(input.price),
    currency: DEFAULT_CURRENCY,
  }, tx)) ?? null

  const listItem = await insertListItem({
    listId,
    itemId: item.id,
    quantityDesired: input.quantityDesired ?? DEFAULT_QUANTITY_DESIRED,
    creatorNote: input.creatorNote ?? null,
    itemStatus: ItemStatuses.AVAILABLE,
  }, tx)
  if (!listItem) return null

  return { item, source, listItem }
}

function buildListItemResponse(record: CreatedListItemRecord): ListItemResponse {
  return {
    ...toListItemDetail(record.listItem),
    item: toItemDetail(record.item),
    source: record.source ? toItemSourceDetail({ ...record.source, shop: null }) : null,
  }
}
