import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { findUserById, softDeleteUser } from '../../db/entities/users/users.repository.js'
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
  const updatedUser = await updateUserProfile(userId, input)

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
