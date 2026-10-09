import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { runWrite } from '../../../shared/utils/admin-write.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import { buildSlugFromName } from '../../../shared/utils/slug.js'
import { findAllTags, countTags } from './admin-tags.repository.js'
import {
  deleteTag,
  findTagById,
  insertTag,
  updateTagRow,
} from '../../../db/entities/tags/tags.repository.js'
import { AdminAction } from '../admin.enums.js'
import { toTagDetail } from '../../../shared/types/tag.js'
import type { TagDetail } from '../../../shared/types/tag.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { ListTagsInput } from './endpoints/list.js'
import type { CreateTagInput } from './endpoints/create.js'
import type { UpdateTagInput } from './endpoints/update.js'

export async function createTag(
  adminId: string,
  input: CreateTagInput,
): Promise<ServiceResult<{ tag: TagDetail }>> {
  const slug = buildSlugFromName(input.name)
  if (slug.length === 0) return serviceError(ErrorCode.TAG_INVALID_NAME)

  const outcome = await runWrite(() =>
    insertTag({ name: slug, slug, createdByUserId: adminId }),
  )
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  const tag = toTagDetail(outcome.row)
  logger.info({ adminId, action: AdminAction.CREATE_TAG, tagId: tag.id, slug: tag.slug })
  return { data: { tag }, httpStatus: HttpStatus.CREATED }
}

export async function listTags(
  input: ListTagsInput,
): Promise<ServiceResult<PaginatedResponse<TagDetail>>> {
  const [rows, total] = await Promise.all([findAllTags(input, input), countTags(input)])

  return {
    data: buildPaginatedResponse(rows.map(toTagDetail), input, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function getTagById(
  id: string,
): Promise<ServiceResult<{ tag: TagDetail }>> {
  const row = await findTagById(id)
  if (!row) return serviceError(ErrorCode.TAG_NOT_FOUND)
  return { data: { tag: toTagDetail(row) }, httpStatus: HttpStatus.OK }
}

export async function updateTagById(
  adminId: string,
  id: string,
  input: UpdateTagInput,
): Promise<ServiceResult<{ tag: TagDetail }>> {
  const existing = await findTagById(id)
  if (!existing) return serviceError(ErrorCode.TAG_NOT_FOUND)

  const patchResult = buildUpdatePatch(input)
  if ('errorCode' in patchResult) return serviceError(patchResult.errorCode)
  const patch = patchResult.patch
  if (Object.keys(patch).length === 0) {
    return { data: { tag: toTagDetail(existing) }, httpStatus: HttpStatus.OK }
  }

  const outcome = await runWrite(() => updateTagRow(id, patch))
  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  logger.info({ adminId, action: AdminAction.UPDATE_TAG, tagId: id, slug: outcome.row.slug })
  return { data: { tag: toTagDetail(outcome.row) }, httpStatus: HttpStatus.OK }
}

export async function deleteTagById(
  adminId: string,
  id: string,
): Promise<ServiceResult<null>> {
  const existing = await findTagById(id)
  if (!existing) return serviceError(ErrorCode.TAG_NOT_FOUND)

  await deleteTag(id)
  logger.warn({ adminId, action: AdminAction.DELETE_TAG, tagId: id, slug: existing.slug })
  return { data: null, httpStatus: HttpStatus.NO_CONTENT }
}

interface UpdatePatchSuccess {
  patch: { name?: string; slug?: string }
}
interface UpdatePatchFailure {
  errorCode: ErrorCode
}

function buildUpdatePatch(input: UpdateTagInput): UpdatePatchSuccess | UpdatePatchFailure {
  if (input.slug !== undefined) {
    return { patch: { name: input.slug, slug: input.slug } }
  }
  if (input.name !== undefined) {
    const normalized = buildSlugFromName(input.name)
    if (normalized.length === 0) return { errorCode: ErrorCode.TAG_INVALID_NAME }
    return { patch: { name: normalized, slug: normalized } }
  }
  return { patch: {} }
}
