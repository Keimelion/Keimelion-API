import { db } from '../../db/client.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import { hashPassword, verifyPassword } from '../../shared/utils/hash.js'
import { findUserById, findUserByIdWithAvatar, anonymizeUser, updatePasswordHash, insertDeletionAudit } from '../../db/entities/users/users.repository.js'
import { deleteAllUserTokens } from '../../db/entities/access-tokens/access-tokens.repository.js'
import { revokeAllUserSessions } from '../../shared/db/user-sessions.js'
import { cleanupReplacedImage, processOptionalImage, rollbackImage } from '../uploads/images.service.js'
import {
  findFeedbackByUser,
  findImagesByUploaderForExport,
  findItemsByCreator,
  findItemSourcesByCreator,
  findListItemsForContributor,
  findListsOwnedByForExport,
  findListTagsForOwner,
  findReservationsForExport,
  findTagsCreatedByUser,
} from './export/rgpd-export.repository.js'
import {
  countMyReservations,
  findMyReservationsPaged,
  updateUserProfile,
} from './users.repository.js'
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
import { buildPaginatedResponse } from '../../shared/schemas/pagination.js'
import { toReservationProfileEntry } from '../reservations/reservations.types.js'
import type { ReservationProfileEntry } from '../reservations/reservations.types.js'
import type { UserDetail, UserWrite } from '../../shared/types/user.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { PaginatedResponse } from '../../shared/types/api.js'
import type { PartialWrite } from '../../shared/types/api.js'
import type { ChangePasswordInput } from './endpoints/change-password.js'
import type { ExportFormat } from './endpoints/export-data.js'
import type { ListMyReservationsInput } from './endpoints/get-my-reservations.js'

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

  if (avatarBuffer && clearAvatar) {
    return serviceError(ErrorCode.UNPROCESSABLE_ENTITY)
  }

  const previous = await findUserById(userId)
  const previousAvatarImageId = previous?.avatarImageId ?? null

  const imageOutcome = await processOptionalImage(avatarBuffer, userId)
  if ('errorCode' in imageOutcome) return serviceError(imageOutcome.errorCode)
  const newImageId = imageOutcome.image?.id ?? null

  const patch = buildAvatarPatch(fieldPatch, newImageId, clearAvatar)
  if (Object.keys(patch).length === 0) {
    return serviceError(ErrorCode.NO_FIELDS_TO_UPDATE)
  }

  const updatedUser = await updateUserProfile(userId, patch)
  if (!updatedUser) {
    await rollbackImage(newImageId, 'user.update_profile')
    return serviceError(ErrorCode.USER_UPDATE_FAILED)
  }

  await cleanupReplacedImage(
    previousAvatarImageId,
    updatedUser.avatarImageId ?? null,
    'user.update_profile',
  )

  return {
    data: { user: toUserDetail({ ...updatedUser, avatarImage: imageOutcome.image }) },
    httpStatus: HttpStatus.OK,
  }
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

export async function listMyReservations(
  userId: string,
  input: ListMyReservationsInput,
): Promise<ServiceResult<PaginatedResponse<ReservationProfileEntry>>> {
  const [rows, total] = await Promise.all([
    findMyReservationsPaged(userId, input, input.sort),
    countMyReservations(userId),
  ])

  return {
    data: buildPaginatedResponse(rows.map(toReservationProfileEntry), input, total),
    httpStatus: HttpStatus.OK,
  }
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

  const [
    rawItems,
    rawItemSources,
    rawListItems,
    rawLists,
    rawTags,
    rawListTags,
    rawFeedback,
    rawReservations,
    rawImages,
  ] = await Promise.all([
    findItemsByCreator(userId),
    findItemSourcesByCreator(userId),
    findListItemsForContributor(userId),
    findListsOwnedByForExport(userId),
    findTagsCreatedByUser(userId),
    findListTagsForOwner(userId),
    findFeedbackByUser(userId),
    findReservationsForExport(userId),
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
      reservations: rawReservations,
      images: rawImages.map(toImageDetail),
    },
    contentType: EXPORT_JSON_CONTENT_TYPE,
    filename: EXPORT_JSON_FILENAME,
  }
}
