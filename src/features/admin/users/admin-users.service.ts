import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { findAllUsers, countAllUsers, adminUpdateUser } from './admin-users.repository.js'
import { findUserById, softDeleteUser } from '../../../db/entities/users/users.repository.js'
import { toAdminUser } from './admin-users.mapper.js'
import { AdminAction } from '../admin.enums.js'
import type { AdminUser } from './admin-users.mapper.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { AdminUpdateUserInput } from './endpoints/update-user.js'

export async function listUsers(input: PaginationInput): Promise<ServiceResult<PaginatedResponse<AdminUser>>> {
  const [userRows, total] = await Promise.all([findAllUsers(input), countAllUsers()])
  const totalPages = Math.ceil(total / input.limit)
  return {
    data: {
      items: userRows.map(toAdminUser),
      pagination: { page: input.page, limit: input.limit, total, totalPages },
    },
    httpStatus: HttpStatus.OK,
  }
}

export async function getUserById(id: string): Promise<ServiceResult<{ user: AdminUser }>> {
  const user = await findUserById(id)

  if (!user) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  return { data: { user: toAdminUser(user) }, httpStatus: HttpStatus.OK }
}

export async function updateUser(
  adminId: string,
  targetUserId: string,
  input: AdminUpdateUserInput,
): Promise<ServiceResult<{ user: AdminUser }>> {
  if (targetUserId === adminId) {
    return serviceError(ErrorCode.FORBIDDEN)
  }

  const targetUser = await findUserById(targetUserId)

  if (!targetUser) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  const updatedUser = await adminUpdateUser(targetUserId, input)

  if (!updatedUser) {
    return serviceError(ErrorCode.USER_UPDATE_FAILED)
  }

  logger.info({ adminId, targetUserId, action: AdminAction.UPDATE_USER })

  return { data: { user: toAdminUser(updatedUser) }, httpStatus: HttpStatus.OK }
}

export async function deleteUser(adminId: string, targetUserId: string): Promise<ServiceResult<{ message: string }>> {
  if (targetUserId === adminId) {
    return serviceError(ErrorCode.FORBIDDEN)
  }

  const targetUser = await findUserById(targetUserId)

  if (!targetUser) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  const deletedUser = await softDeleteUser(targetUserId)

  if (!deletedUser) {
    return serviceError(ErrorCode.ACCOUNT_DELETION_FAILED)
  }

  logger.info({ adminId, targetUserId, action: AdminAction.DELETE_USER })

  return { data: { message: 'User deleted successfully' }, httpStatus: HttpStatus.OK }
}
