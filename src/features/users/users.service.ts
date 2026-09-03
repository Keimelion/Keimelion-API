import { db } from '../../db/client.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { pickDefined } from '../../shared/utils/partial-update.js'
import { hashPassword, verifyPassword } from '../../shared/utils/hash.js'
import { findUserById, anonymizeUser, updatePasswordHash, insertDeletionAudit } from '../../db/entities/users/users.repository.js'
import { deleteAllUserTokens } from '../../db/entities/access-tokens/access-tokens.repository.js'
import { deleteAllUserRefreshTokens } from '../../db/entities/refresh-tokens/refresh-tokens.repository.js'
import { updateUserProfile } from './users.repository.js'
import { toPublicUser, toBaseUser } from './users.mapper.js'
import type { PublicUser } from './users.mapper.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { UpdateProfileInput } from './endpoints/update-profile.js'
import type { ChangePasswordInput } from './endpoints/change-password.js'
import type { ExportFormat } from './endpoints/export-data.js'

const EXPORT_JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
const EXPORT_CSV_CONTENT_TYPE = 'text/csv; charset=utf-8'
const CSV_FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r'])

interface ExportResult {
  body: string
  contentType: string
  filename: string
}

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

export async function deleteAccount(userId: string, originalEmail: string): Promise<ServiceResult<{ message: string }>> {
  const anonymizedEmail = `deleted_${userId}@deleted.keimelion.fr`

  await db.transaction(async (tx) => {
    await anonymizeUser(tx, userId, anonymizedEmail)
    await insertDeletionAudit(tx, { userId, email: originalEmail, deletedAt: new Date(), reason: 'user_request' })
    await deleteAllUserTokens(userId, tx)
    await deleteAllUserRefreshTokens(userId, tx)
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
  const user = await findUserById(userId)
  const profile = user ? toBaseUser(user) : null
  const exportPayload = { profile }

  if (format === 'csv') {
    return {
      body: serializeExportToCsv(exportPayload),
      contentType: EXPORT_CSV_CONTENT_TYPE,
      filename: 'keimelion-export.csv',
    }
  }

  return {
    body: JSON.stringify(exportPayload, null, 2),
    contentType: EXPORT_JSON_CONTENT_TYPE,
    filename: 'keimelion-export.json',
  }
}

interface ExportPayload {
  profile: PublicUser | null
}

function serializeExportToCsv(payload: ExportPayload): string {
  const rows: string[] = []

  rows.push('section,field,value')

  if (payload.profile) {
    const profileEntries = Object.entries(payload.profile) as [string, unknown][]
    for (const [field, value] of profileEntries) {
      rows.push(`profile,${field},${serializeCsvCell(value)}`)
    }
  }

  return rows.join('\n')
}

function toCsvString(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function serializeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const stringValue = neutralizeCsvFormula(toCsvString(value))
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function neutralizeCsvFormula(value: string): string {
  if (value.length === 0) return value
  const firstChar = value.charAt(0)
  if (CSV_FORMULA_TRIGGERS.has(firstChar)) return `'${value}`
  return value
}
