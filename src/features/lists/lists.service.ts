import { db } from '../../db/client.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { ItemStatuses } from '../../shared/enums/item-status.js'
import { ListStatuses } from '../../shared/enums/list-status.js'
import { serviceError } from '../../shared/utils/response.js'
import { runWrite } from '../../shared/utils/admin-write.js'
import { buildPaginatedResponse } from '../../shared/schemas/pagination.js'
import { buildSlugFromTitle, normalizeTagSlugs } from '../../shared/utils/slug.js'
import { isPgForeignKeyViolation, isPgUniqueViolation } from '../../shared/db/pg-errors.js'
import { logger } from '../../shared/utils/logger.js'
import { findItemById } from '../../db/entities/items/items.repository.js'
import { insertListItem } from '../../db/entities/list-items/list-items.repository.js'
import {
  buildListUpdatePatch,
  findListWithOwner,
  insertList,
  updateList,
  softDeleteList,
} from '../../db/entities/lists/lists.repository.js'
import { insertListUser } from '../../db/entities/list-users/list-users.repository.js'
import { ListUserRoles } from '../../shared/enums/list-user-role.js'
import { upsertTagsBySlugs } from '../../db/entities/tags/tags.repository.js'
import { replaceListTags } from '../../db/entities/list-tags/list-tags.repository.js'
import { toItemDetail, toListItemDetail } from '../../shared/types/item.js'
import { toListDetail } from '../../shared/types/list.js'
import { findListsAccessibleBy, countListsAccessibleBy } from './lists.repository.js'
import { buildCollaboratorsByListId, buildCollaboratorsForList } from './collaborators.mapper.js'
import type { User } from '../../db/entities/users/users.schema.js'
import type { InsertList } from '../../db/entities/lists/lists.repository.js'
import type { ListDetail, ListRowWithOwner } from '../../shared/types/list.js'
import type { ListItemResponse } from './lists.types.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { PaginatedResponse } from '../../shared/types/api.js'
import type { AddItemInput } from './endpoints/add-item.js'
import type { CreateListInput } from './endpoints/create.js'
import type { ListUserListsInput } from './endpoints/list.js'
import type { UpdateListInput } from './endpoints/update.js'

const DEFAULT_QUANTITY_DESIRED = 1
const MAX_SLUG_RETRIES = 3

export async function createUserList(
  user: User,
  input: CreateListInput,
): Promise<ServiceResult<{ list: ListDetail }>> {
  let tagSlugs: string[] | null = null
  if (input.tags !== undefined) {
    tagSlugs = normalizeTagSlugs(input.tags)
    if (tagSlugs === null) return serviceError(ErrorCode.TAG_INVALID_NAME)
  }

  const outcome = await insertListWithSlugRetry(user, input, tagSlugs)
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  const sourceRow =
    tagSlugs !== null && tagSlugs.length > 0
      ? (await findListWithOwner(outcome.row.id)) ?? outcome.row
      : outcome.row
  return {
    data: { list: toListDetail(sourceRow, await buildCollaboratorsForList(sourceRow)) },
    httpStatus: HttpStatus.CREATED,
  }
}

export async function listUserLists(
  userId: string,
  input: ListUserListsInput,
): Promise<ServiceResult<PaginatedResponse<ListDetail>>> {
  const [rows, total] = await Promise.all([
    findListsAccessibleBy(userId, input, input.sort),
    countListsAccessibleBy(userId),
  ])

  const collaboratorsByListId = await buildCollaboratorsByListId(rows)
  const items = rows.map((row) => toListDetail(row, collaboratorsByListId.get(row.id) ?? []))
  return {
    data: buildPaginatedResponse(items, input, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function getUserListById(list: ListRowWithOwner): Promise<ServiceResult<{ list: ListDetail }>> {
  return {
    data: { list: toListDetail(list, await buildCollaboratorsForList(list)) },
    httpStatus: HttpStatus.OK,
  }
}

export async function updateUserList(
  existing: ListRowWithOwner,
  userId: string,
  input: UpdateListInput,
): Promise<ServiceResult<{ list: ListDetail }>> {
  const fieldPatch = buildListUpdatePatch(input)
  const { tags } = input
  if (Object.keys(fieldPatch).length === 0 && tags === undefined) {
    return serviceError(ErrorCode.NO_FIELDS_TO_UPDATE)
  }

  let tagSlugs: string[] | null = null
  if (tags !== undefined) {
    tagSlugs = normalizeTagSlugs(tags)
    if (tagSlugs === null) return serviceError(ErrorCode.TAG_INVALID_NAME)
  }

  const writeOutcome = await runWrite(
    () =>
      db.transaction(async (tx) => {
        const updated =
          Object.keys(fieldPatch).length > 0
            ? await updateList(existing.id, fieldPatch, tx)
            : existing
        if (tagSlugs !== null) {
          const tagIds = await upsertTagsBySlugs(tagSlugs, userId, tx)
          await replaceListTags(existing.id, tagIds, tx)
        }
        return updated
      }),
    { foreignKeyErrorCode: ErrorCode.UNPROCESSABLE_ENTITY },
  )
  if ('errorCode' in writeOutcome) return serviceError(writeOutcome.errorCode)

  if (tagSlugs === null) {
    const refreshed: ListRowWithOwner = {
      ...writeOutcome.row,
      listUsers: existing.listUsers,
      listTags: existing.listTags,
    }
    return {
      data: { list: toListDetail(refreshed, await buildCollaboratorsForList(refreshed)) },
      httpStatus: HttpStatus.OK,
    }
  }

  const refreshed = await findListWithOwner(existing.id)
  if (!refreshed) return serviceError(ErrorCode.NOT_FOUND)
  return {
    data: { list: toListDetail(refreshed, await buildCollaboratorsForList(refreshed)) },
    httpStatus: HttpStatus.OK,
  }
}

export async function deleteUserList(id: string): Promise<ServiceResult<null>> {
  await softDeleteList(id)
  return { data: null, httpStatus: HttpStatus.NO_CONTENT }
}

export async function addItemToList(
  listId: string,
  input: AddItemInput,
): Promise<ServiceResult<{ listItem: ListItemResponse }>> {
  const item = await findItemById(input.itemId)
  if (!item) return serviceError(ErrorCode.NOT_FOUND)

  const listItem = await insertListItem({
    listId,
    itemId: item.id,
    quantityDesired: input.quantityDesired ?? DEFAULT_QUANTITY_DESIRED,
    creatorNote: input.creatorNote ?? null,
    itemStatus: ItemStatuses.AVAILABLE,
  })
  if (!listItem) return serviceError(ErrorCode.INTERNAL_ERROR)

  return {
    data: {
      listItem: {
        ...toListItemDetail(listItem),
        item: toItemDetail(item),
        source: null,
      },
    },
    httpStatus: HttpStatus.CREATED,
  }
}

async function insertListWithSlugRetry(
  user: User,
  input: CreateListInput,
  tagSlugs: string[] | null,
): Promise<{ row: ListRowWithOwner } | { errorCode: ErrorCode }> {
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt += 1) {
    const slug = buildSlugFromTitle(input.title)
    const outcome = await tryInsertList(user, input, slug, tagSlugs)
    if ('row' in outcome) return outcome
    if (outcome.retriable) continue
    return { errorCode: outcome.errorCode }
  }
  return { errorCode: ErrorCode.SLUG_GENERATION_EXHAUSTED }
}

interface InsertAttemptFailure {
  errorCode: ErrorCode
  retriable: boolean
}

async function tryInsertList(
  user: User,
  input: CreateListInput,
  slug: string,
  tagSlugs: string[] | null,
): Promise<{ row: ListRowWithOwner } | InsertAttemptFailure> {
  try {
    const created = await db.transaction(async (tx) => {
      const inserted = await insertList(buildCreatePayload(input, slug), tx)
      if (!inserted) throw new Error('List insert returned no row')
      const ownerMembership = await insertListUser(inserted.id, user.id, ListUserRoles.OWNER, tx)
      if (!ownerMembership) throw new Error('Owner list_users insert returned no row')
      if (tagSlugs !== null && tagSlugs.length > 0) {
        const tagIds = await upsertTagsBySlugs(tagSlugs, user.id, tx)
        await replaceListTags(inserted.id, tagIds, tx)
      }
      return { list: inserted, ownerMembership }
    })
    const row: ListRowWithOwner = {
      ...created.list,
      listUsers: [{ ...created.ownerMembership, user }],
      listTags: [],
    }
    return { row }
  } catch (error) {
    if (isPgUniqueViolation(error)) return { errorCode: ErrorCode.CONFLICT, retriable: true }
    if (isPgForeignKeyViolation(error)) return { errorCode: ErrorCode.UNPROCESSABLE_ENTITY, retriable: false }
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
    listStatus: ListStatuses.ACTIVE,
  }
}

