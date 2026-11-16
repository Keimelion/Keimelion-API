import { randomBytes } from 'crypto'
import { db } from '../../../db/client.js'
import { env } from '../../../config/env.js'
import { buildPaginatedResponse } from '../../../shared/utils/pagination.js'
import { ErrorCode, HttpStatus } from '@keimelion/sdk/enums'
import type { StaffRole } from '@keimelion/sdk/enums'
import type {
  AdminUsersCreateRequestParsed,
  AdminUsersCreateResponseParsed,
  AdminUsersResendInvitationResponseParsed,
  AdminUsersUpdateRequestParsed,
  PaginatedResponse,
} from '@keimelion/sdk/schemas'
import { NodeEnvs } from '../../../shared/enums/node-env.js'
import { sendMailInBackground } from '../../../shared/mail/mail.background.js'
import { EMAIL_DEFAULT_LOCALE } from '../../../shared/mail/mail.locale.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { ONE_HOUR_MS } from '../../../shared/utils/time.js'
import { hashPassword, hashSha256Hex } from '../../../shared/utils/hash.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { runWrite } from '../../../shared/utils/admin-write.js'
import { isStaffRole } from '../../../shared/utils/staff-role.js'
import {
  findAllUsers,
  countUsers,
  adminUpdateUser,
  adminInsertUser,
  renewStaffInvitationToken,
} from './admin-users.repository.js'
import { findUserById, findUserByIdWithAvatar, softDeleteUser } from '../../../db/entities/users/users.repository.js'
import { revokeAllUserSessions } from '../../../shared/db/user-sessions.js'
import { cleanupReplacedImage } from '../../uploads/images.service.js'
import { toAdminUser } from './admin-users.mapper.js'
import { buildStaffInvitationEmail } from './emails/staff-invitation.email.js'
import {
  countReservationsByUserIds,
  countReservationsForUser,
} from '../../../db/entities/reservations/reservations.repository.js'
import { AdminAction } from '../admin.enums.js'
import type { AdminUser } from './admin-users.mapper.js'
import type { User } from '../../../db/entities/users/users.schema.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { ListUsersInput } from './endpoints/list-users.js'

const STAFF_INVITATION_VALIDITY_HOURS = 24
const PASSWORD_RESET_TOKEN_BYTE_LENGTH = 32
const STAFF_INVITATION_EMAIL_FAILED_EVENT = 'admin_staff_invitation_email_failed'

interface StaffInvitationToken {
  rawToken: string
  hashedToken: string
  expiresAt: Date
}

interface StaffInvitationRecipient {
  email: string
  role: StaffRole
}

// Outside production the raw token is returned so the set-password flow can be tested end to end
interface DevPasswordResetToken {
  passwordResetToken?: string
}

export async function createUser(
  adminId: string,
  input: AdminUsersCreateRequestParsed,
): Promise<ServiceResult<AdminUsersCreateResponseParsed & DevPasswordResetToken>> {
  const invitationToken = generateStaffInvitationToken()
  const rawPassword = randomBytes(PASSWORD_RESET_TOKEN_BYTE_LENGTH).toString('hex')
  const passwordHash = await hashPassword(rawPassword)

  const outcome = await runWrite(
    () =>
      adminInsertUser({
        email: input.email,
        username: input.username,
        passwordHash,
        role: input.role,
        passwordResetToken: invitationToken.hashedToken,
        passwordResetTokenExpiresAt: invitationToken.expiresAt,
      }),
    { fallbackErrorCode: ErrorCode.USER_CREATION_FAILED },
  )

  if ('errorCode' in outcome) return serviceError(outcome.errorCode)

  const createdUser = toAdminUser({ ...outcome.row, avatarImage: null }, 0)

  logAdminUserCreation(adminId, createdUser.id, input.role)
  sendStaffInvitationEmail(input, invitationToken.rawToken)

  return {
    data: { user: createdUser, ...exposeTokenOutsideProduction(invitationToken.rawToken) },
    httpStatus: HttpStatus.CREATED,
  }
}

export async function resendStaffInvitation(
  adminId: string,
  targetUserId: string,
): Promise<ServiceResult<AdminUsersResendInvitationResponseParsed & DevPasswordResetToken>> {
  const targetUser = await findUserByIdWithAvatar(targetUserId)

  if (!targetUser) return serviceError(ErrorCode.NOT_FOUND)
  if (!isStaffRole(targetUser.role)) return serviceError(ErrorCode.STAFF_INVITATION_NOT_STAFF_ACCOUNT)

  const invitationToken = generateStaffInvitationToken()
  const renewedUser = await renewStaffInvitationToken(targetUserId, {
    passwordResetToken: invitationToken.hashedToken,
    passwordResetTokenExpiresAt: invitationToken.expiresAt,
  })

  if (!renewedUser) return serviceError(ErrorCode.STAFF_INVITATION_NOT_PENDING)

  logger.warn({ adminId, targetUserId, action: AdminAction.RESEND_STAFF_INVITATION, role: targetUser.role })
  sendStaffInvitationEmail({ email: renewedUser.email, role: targetUser.role }, invitationToken.rawToken)

  const reservationsCount = await countReservationsForUser(targetUserId)
  const user = toAdminUser({ ...renewedUser, avatarImage: targetUser.avatarImage }, reservationsCount)

  return {
    data: { user, ...exposeTokenOutsideProduction(invitationToken.rawToken) },
    httpStatus: HttpStatus.OK,
  }
}

export async function listUsers(input: ListUsersInput): Promise<ServiceResult<PaginatedResponse<AdminUser>>> {
  const [userRows, total] = await Promise.all([findAllUsers(input, input), countUsers(input)])
  const countByUserId = await countReservationsByUserIds(userRows.map((row) => row.id))

  return {
    data: buildPaginatedResponse(
      userRows.map((row) => toAdminUser(row, countByUserId.get(row.id) ?? 0)),
      input,
      total,
    ),
    httpStatus: HttpStatus.OK,
  }
}

export async function getUserById(id: string): Promise<ServiceResult<{ user: AdminUser }>> {
  const user = await findUserByIdWithAvatar(id)

  if (!user) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  const reservationsCount = await countReservationsForUser(id)
  return { data: { user: toAdminUser(user, reservationsCount) }, httpStatus: HttpStatus.OK }
}

export async function updateUser(
  adminId: string,
  targetUserId: string,
  input: AdminUsersUpdateRequestParsed,
): Promise<ServiceResult<{ user: AdminUser }>> {
  if (targetUserId === adminId) {
    return serviceError(ErrorCode.FORBIDDEN)
  }

  const { clearAvatar, ...fields } = input
  const patch = { ...pickDefined(fields), ...(clearAvatar && { avatarImageId: null }) }
  if (Object.keys(patch).length === 0) return serviceError(ErrorCode.NO_FIELDS_TO_UPDATE)

  const targetUser = await findUserByIdWithAvatar(targetUserId)

  if (!targetUser) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  const shouldRevoke = input.role !== undefined && input.role !== targetUser.role

  let updatedRow: User | undefined

  await db.transaction(async (tx) => {
    const result = await adminUpdateUser(targetUserId, patch, tx)
    if (!result) return
    updatedRow = result
    if (shouldRevoke) {
      await revokeAllUserSessions(targetUserId, tx)
    }
  })

  if (!updatedRow) {
    return serviceError(ErrorCode.USER_UPDATE_FAILED)
  }
  await cleanupReplacedImage(targetUser.avatarImageId, updatedRow.avatarImageId, 'admin.update_user')

  const reservationsCount = await countReservationsForUser(targetUserId)
  const avatarImage = updatedRow.avatarImageId === null ? null : targetUser.avatarImage
  const updatedUser = toAdminUser({ ...updatedRow, avatarImage }, reservationsCount)

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

// Every created account is a staff account: always a warning, so privilege grants stand out
function logAdminUserCreation(adminId: string, targetUserId: string, role: StaffRole): void {
  logger.warn({ adminId, targetUserId, action: AdminAction.CREATE_USER, role })
}

function generateStaffInvitationToken(): StaffInvitationToken {
  const rawToken = randomBytes(PASSWORD_RESET_TOKEN_BYTE_LENGTH).toString('hex')
  return {
    rawToken,
    hashedToken: hashSha256Hex(rawToken),
    expiresAt: new Date(Date.now() + STAFF_INVITATION_VALIDITY_HOURS * ONE_HOUR_MS),
  }
}

function exposeTokenOutsideProduction(rawToken: string): DevPasswordResetToken {
  return env.NODE_ENV === NodeEnvs.PRODUCTION ? {} : { passwordResetToken: rawToken }
}

// The recipient's language is unknown: the invitation goes out in the default email locale
function sendStaffInvitationEmail(recipient: StaffInvitationRecipient, setPasswordToken: string): void {
  sendMailInBackground(STAFF_INVITATION_EMAIL_FAILED_EVENT, () => ({
    to: recipient.email,
    ...buildStaffInvitationEmail({
      locale: EMAIL_DEFAULT_LOCALE,
      role: recipient.role,
      email: recipient.email,
      setPasswordToken,
      validityHours: STAFF_INVITATION_VALIDITY_HOURS,
    }),
  }))
}
