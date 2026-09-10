import { randomBytes } from 'crypto'
import { db } from '../../../db/client.js'
import { env } from '../../../config/env.js'
import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { NodeEnvs } from '../../../shared/enums/node-env.js'
import { UserRoles } from '../../../shared/enums/user-role.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { hashPassword, hashSha256Hex } from '../../../shared/utils/hash.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { isPgUniqueViolation } from '../../../shared/db/pg-errors.js'
import { findAllUsers, countUsers, adminUpdateUser, adminInsertUser } from './admin-users.repository.js'
import { findUserById, softDeleteUser } from '../../../db/entities/users/users.repository.js'
import { deleteAllUserTokens } from '../../../db/entities/access-tokens/access-tokens.repository.js'
import { deleteAllUserRefreshTokens } from '../../../db/entities/refresh-tokens/refresh-tokens.repository.js'
import { toAdminUser } from './admin-users.mapper.js'
import { AdminAction } from '../admin.enums.js'
import type { AdminUser } from './admin-users.mapper.js'
import type { UserRole } from '../../../shared/enums/user-role.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import type { ListUsersInput } from './endpoints/list-users.js'
import type { AdminUpdateUserInput } from './endpoints/update-user.js'
import type { AdminCreateUserInput } from './endpoints/create-user.js'

const ADMIN_PASSWORD_RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const PASSWORD_RESET_TOKEN_BYTE_LENGTH = 32

export async function createUser(
  adminId: string,
  input: AdminCreateUserInput,
): Promise<ServiceResult<{ user: AdminUser; passwordResetToken?: string }>> {
  const rawPasswordResetToken = randomBytes(PASSWORD_RESET_TOKEN_BYTE_LENGTH).toString('hex')
  const hashedPasswordResetToken = hashSha256Hex(rawPasswordResetToken)
  const passwordResetTokenExpiresAt = new Date(Date.now() + ADMIN_PASSWORD_RESET_TOKEN_TTL_MS)

  const rawPassword = randomBytes(PASSWORD_RESET_TOKEN_BYTE_LENGTH).toString('hex')
  const passwordHash = await hashPassword(rawPassword)

  let createdUser: AdminUser

  try {
    const inserted = await adminInsertUser({
      email: input.email,
      username: input.username,
      passwordHash,
      role: input.role,
      passwordResetToken: hashedPasswordResetToken,
      passwordResetTokenExpiresAt,
    })

    if (!inserted) {
      return serviceError(ErrorCode.USER_CREATION_FAILED)
    }

    createdUser = toAdminUser(inserted)
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      return serviceError(ErrorCode.CONFLICT)
    }
    return serviceError(ErrorCode.USER_CREATION_FAILED)
  }

  logAdminUserCreation(adminId, createdUser.id, input.role)
  sendAdminInvitationEmail(input.email, rawPasswordResetToken)

  return {
    data: {
      user: createdUser,
      ...(env.NODE_ENV !== NodeEnvs.PRODUCTION ? { passwordResetToken: rawPasswordResetToken } : {}),
    },
    httpStatus: HttpStatus.CREATED,
  }
}

export async function listUsers(input: ListUsersInput): Promise<ServiceResult<PaginatedResponse<AdminUser>>> {
  const [userRows, total] = await Promise.all([findAllUsers(input, input), countUsers(input)])

  return {
    data: buildPaginatedResponse(userRows.map(toAdminUser), input, total),
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

  const shouldRevoke = input.role !== undefined && input.role !== targetUser.role

  let updatedUser: AdminUser | undefined

  await db.transaction(async (tx) => {
    const result = await adminUpdateUser(targetUserId, pickDefined(input), tx)
    if (!result) return
    updatedUser = toAdminUser(result)
    if (shouldRevoke) {
      await deleteAllUserTokens(targetUserId, tx)
      await deleteAllUserRefreshTokens(targetUserId, tx)
    }
  })

  if (!updatedUser) {
    return serviceError(ErrorCode.USER_UPDATE_FAILED)
  }

  logger.info({
    adminId,
    targetUserId,
    action: AdminAction.UPDATE_USER,
    tokensRevoked: shouldRevoke,
    ...(shouldRevoke && { roleChanged: { from: targetUser.role, to: input.role } }),
  })

  return { data: { user: updatedUser }, httpStatus: HttpStatus.OK }
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

function logAdminUserCreation(adminId: string, targetUserId: string, role: UserRole): void {
  const payload = { adminId, targetUserId, action: AdminAction.CREATE_USER, role }
  const isPrivilegedRole = role === UserRoles.MODERATOR || role === UserRoles.ADMIN

  if (isPrivilegedRole) {
    logger.warn(payload)
    return
  }

  logger.info(payload)
}

function sendAdminInvitationEmail(email: string, rawPasswordResetToken: string): void {
  const passwordResetUrl = new URL(`/auth/reset-password?token=${rawPasswordResetToken}`, env.APP_URL).href

  if (env.NODE_ENV !== NodeEnvs.PRODUCTION) {
    logger.info({ email, passwordResetUrl }, 'Admin invitation URL (dev/test)')
    return
  }

  logger.info({ email }, 'Sending admin invitation email via Resend')
}
