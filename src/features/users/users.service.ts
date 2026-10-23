import { db } from '../../db/client.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import { logger } from '../../shared/utils/logger.js'
import { hashPassword, verifyPassword } from '../../shared/utils/hash.js'
import { findUserById, findUserByIdWithAvatar, anonymizeUser, updatePasswordHash, insertDeletionAudit } from '../../db/entities/users/users.repository.js'
import { deleteAllUserTokens } from '../../db/entities/access-tokens/access-tokens.repository.js'
import { revokeAllUserSessions } from '../../shared/db/user-sessions.js'
import { deleteImageById } from '../../db/entities/images/images.repository.js'
import { processImage } from '../uploads/image.pipeline.js'
import {
  findFeedbackByUser,
  findImagesByUploaderForExport,
  findItemsByCreator,
  findItemSourcesByCreator,
  findListItemsForContributor,
  findListsOwnedByForExport,
  findListTagsForOwner,
  findTagsCreatedByUser,
} from './export/rgpd-export.repository.js'
import { updateUserProfile } from './users.repository.js'
import { toUserDetail } from '../../shared/types/user.js'
import { toFeedbackDetail } from '../../shared/types/feedback.js'
import { toItemDetail, toItemSourceDetailWithoutShop, toListItemDetail } from '../../shared/types/item.js'
import { toTagDetail } from '../../shared/types/tag.js'
import { toImageDetail } from '../uploads/images.mapper.js'
import { buildExportZipStream } from './export/csv-archive-writer.js'
import {
  EXPORT_ENTITY_REGISTRY,
  toExportListRow,
  toExportListTagRow,
} from './export/export-entities.js'
import type { UserDetail, UserWrite } from '../../shared/types/user.js'
import type { Image } from '../../db/entities/images/images.schema.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { PartialWrite } from '../../shared/types/api.js'
import type { ChangePasswordInput } from './endpoints/change-password.js'
import type { ExportFormat } from './endpoints/export-data.js'

export interface UpdateUserProfileInput extends PartialWrite<UserWrite> {
  avatarBuffer: Buffer | null
  clearAvatar: boolean
}

const EXPORT_JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
const EXPORT_ZIP_CONTENT_TYPE = 'application/zip'
const EXPORT_ZIP_FILENAME = 'keimelion-export.zip'
const EXPORT_JSON_FILENAME = 'keimelion-export.json'

interface JsonExportResult {
  kind: 'json'
  payload: Record<string, unknown>
  contentType: string
  filename: string
}

interface ZipExportResult {
  kind: 'zip'
  stream: ReadableStream<Uint8Array>
  contentType: string
  filename: string
}

export type ExportResult = JsonExportResult | ZipExportResult

export async function getProfile(userId: string): Promise<ServiceResult<{ user: UserDetail }>> {
  const user = await findUserByIdWithAvatar(userId)

  if (!user) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  return { data: { user: toUserDetail(user) }, httpStatus: HttpStatus.OK }
}

export async function updateProfile(
  userId: string,
  input: UpdateUserProfileInput,
): Promise<ServiceResult<{ user: UserDetail }>> {
  const { avatarBuffer, clearAvatar, ...rest } = input
  const fieldPatch = pickDefined(rest)

  const imageOutcome = await maybeProcessAvatar(avatarBuffer, userId)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)

  const patch = buildAvatarPatch(fieldPatch, imageOutcome.image?.id ?? null, clearAvatar)
  if (Object.keys(patch).length === 0) {
    return serviceError(ErrorCode.NO_FIELDS_TO_UPDATE)
  }

  const updatedUser = await updateUserProfile(userId, patch)
  if (!updatedUser) {
    await rollbackAvatarImage(imageOutcome.image?.id ?? null)
    return serviceError(ErrorCode.USER_UPDATE_FAILED)
  }

  return {
    data: { user: toUserDetail({ ...updatedUser, avatarImage: imageOutcome.image }) },
    httpStatus: HttpStatus.OK,
  }
}

async function maybeProcessAvatar(
  buffer: Buffer | null,
  uploadedBy: string,
): Promise<{ image: Image | null } | { errorCode: ErrorCode }> {
  if (!buffer) return { image: null }
  const result = await processImage(buffer, uploadedBy)
  if ('errorCode' in result) return { errorCode: result.errorCode }
  return { image: result.image }
}

function buildAvatarPatch(
  fieldPatch: Partial<UserWrite>,
  newImageId: string | null,
  clearAvatar: boolean,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { ...fieldPatch }
  if (newImageId !== null) {
    patch.avatarImageId = newImageId
  } else if (clearAvatar) {
    patch.avatarImageId = null
  }
  return patch
}

async function rollbackAvatarImage(imageId: string | null): Promise<void> {
  if (!imageId) return
  try {
    await deleteImageById(imageId)
  } catch (error: unknown) {
    logger.error({ error, imageId }, 'Failed to rollback avatar image after user update failure')
  }
}

export async function deleteAccount(userId: string, originalEmail: string): Promise<ServiceResult<{ message: string }>> {
  const anonymizedEmail = `deleted_${userId}@deleted.keimelion.fr`

  await db.transaction(async (tx) => {
    await anonymizeUser(tx, userId, anonymizedEmail)
    await insertDeletionAudit(tx, { userId, email: originalEmail, deletedAt: new Date(), reason: 'user_request' })
    await revokeAllUserSessions(userId, tx)
  })

  return { data: { message: 'Account deleted successfully' }, httpStatus: HttpStatus.OK }
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<ServiceResult<{ message: string }>> {
  const user = await findUserById(userId)

  if (!user) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  if (!user.passwordHash) {
    return serviceError(ErrorCode.INVALID_OPERATION)
  }

  const isCurrentPasswordValid = await verifyPassword(input.currentPassword, user.passwordHash)

  if (!isCurrentPasswordValid) {
    return serviceError(ErrorCode.INVALID_CREDENTIALS)
  }

  const newPasswordHash = await hashPassword(input.newPassword)

  await db.transaction(async (tx) => {
    await updatePasswordHash(userId, newPasswordHash, tx)
    await deleteAllUserTokens(userId, tx)
  })

  return { data: { message: 'Password changed successfully' }, httpStatus: HttpStatus.OK }
}

export async function exportUserData(userId: string, format: ExportFormat): Promise<ExportResult> {
  if (format === 'csv') {
    const zipStream = await buildExportZipStream(userId, EXPORT_ENTITY_REGISTRY)
    return {
      kind: 'zip',
      stream: zipStream,
      contentType: EXPORT_ZIP_CONTENT_TYPE,
      filename: EXPORT_ZIP_FILENAME,
    }
  }

  const user = await findUserById(userId)
  const profile = user ? toUserDetail(user) : null

  const [rawItems, rawItemSources, rawListItems, rawLists, rawTags, rawListTags, rawFeedback, rawImages] = await Promise.all([
    findItemsByCreator(userId),
    findItemSourcesByCreator(userId),
    findListItemsForContributor(userId),
    findListsOwnedByForExport(userId),
    findTagsCreatedByUser(userId),
    findListTagsForOwner(userId),
    findFeedbackByUser(userId),
    findImagesByUploaderForExport(userId),
  ])

  return {
    kind: 'json',
    payload: {
      profile,
      items: rawItems.map(toItemDetail),
      itemSources: rawItemSources.map(toItemSourceDetailWithoutShop),
      listItems: rawListItems.map((row) => toListItemDetail(row)),
      lists: rawLists.map(toExportListRow),
      tags: rawTags.map(toTagDetail),
      listTags: rawListTags.map(toExportListTagRow),
      feedback: rawFeedback.map(toFeedbackDetail),
      images: rawImages.map(toImageDetail),
    },
    contentType: EXPORT_JSON_CONTENT_TYPE,
    filename: EXPORT_JSON_FILENAME,
  }
}
