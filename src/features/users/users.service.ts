import { db } from '../../db/client.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import { hashPassword, verifyPassword } from '../../shared/utils/hash.js'
import { findUserById, softDeleteUser, updatePasswordHash } from '../../db/entities/users/users.repository.js'
import { deleteAllUserTokens } from '../../db/entities/active-tokens/active-tokens.repository.js'
import { updateUserProfile } from './users.repository.js'
import { toPublicUser } from './users.mapper.js'
import type { PublicUser } from './users.mapper.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { UpdateProfileInput } from './endpoints/update-profile.js'

export async function getProfile(userId: string): Promise<ServiceResult<{ user: PublicUser }>> {
  const user = await findUserById(userId)

  if (!user) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  return { data: { user: toPublicUser(user) }, httpStatus: HttpStatus.OK }
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<ServiceResult<{ user: PublicUser }>> {
  const updatedUser = await updateUserProfile(userId, pickDefined(input))

  if (!updatedUser) {
    return serviceError(ErrorCode.USER_UPDATE_FAILED)
  }

  return { data: { user: toPublicUser(updatedUser) }, httpStatus: HttpStatus.OK }
}

export async function deleteAccount(userId: string): Promise<ServiceResult<{ message: string }>> {
  const deletedUser = await softDeleteUser(userId)

  if (!deletedUser) {
    return serviceError(ErrorCode.ACCOUNT_DELETION_FAILED)
  }

  return { data: { message: 'Account deleted successfully' }, httpStatus: HttpStatus.OK }
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<ServiceResult<null>> {
  const user = await findUserById(userId)

  if (!user) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  if (!user.passwordHash) {
    return serviceError(ErrorCode.INVALID_OPERATION)
  }

  const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash)

  if (!isCurrentPasswordValid) {
    return serviceError(ErrorCode.INVALID_CREDENTIALS)
  }

  const newPasswordHash = await hashPassword(newPassword)

  await db.transaction(async (tx) => {
    await updatePasswordHash(userId, newPasswordHash, tx)
    await deleteAllUserTokens(userId, tx)
  })

  return { data: null, httpStatus: HttpStatus.NO_CONTENT }
}
