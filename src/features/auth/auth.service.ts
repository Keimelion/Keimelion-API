import { randomUUID, randomBytes } from 'crypto'
import { env } from '../../config/env.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { NodeEnvs } from '../../shared/enums/node-env.js'
import { serviceError } from '../../shared/utils/response.js'
import { hashPassword, verifyPassword, hashSha256Hex } from '../../shared/utils/hash.js'
import { logger } from '../../shared/utils/logger.js'
import { signJwt } from './jwt.service.js'
import type { JwtPayload } from './jwt.service.js'
import {
  findUserByEmail,
  findUserByEmailVerifyToken,
  findUserByPasswordResetToken,
  insertUser,
  markEmailAsVerified,
  setPasswordResetToken,
  resetUserPassword,
} from '../users/users.repository.js'
import { toPublicUser } from '../users/users.mapper.js'
import {
  storeTokenAndUpdateActivity,
  revokeTokenAndUpdateActivity,
  rotateRefreshTokenAndIssueAccessToken,
} from './auth.repository.js'
import { deleteAllUserTokens } from '../../db/entities/active-tokens/active-tokens.repository.js'
import { insertRefreshToken, findRefreshTokenByHash } from '../../db/entities/refresh-tokens/refresh-tokens.repository.js'
import { findUserById } from '../../db/entities/users/users.repository.js'
import type { PublicUser } from '../users/users.mapper.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { RegisterInput } from './endpoints/register.js'
import type { VerifyEmailInput } from './endpoints/verify-email.js'
import type { LoginInput } from './endpoints/login.js'
import type { ForgotPasswordInput } from './endpoints/forgot-password.js'
import type { ResetPasswordInput } from './endpoints/reset-password.js'

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000
const REFRESH_TOKEN_BYTE_LENGTH = 32

export async function registerUser(input: RegisterInput): Promise<ServiceResult<{ user: PublicUser; refreshToken: string }>> {
  if (await isEmailAlreadyTaken(input.email)) {
    return serviceError(ErrorCode.CONFLICT)
  }

  const emailVerifyToken = randomUUID()
  const createdUser = await insertUser(input, emailVerifyToken)

  if (!createdUser) {
    return serviceError(ErrorCode.USER_CREATION_FAILED)
  }

  sendVerificationEmail(input.email, emailVerifyToken)

  const rawRefreshToken = await issueRefreshToken(createdUser.id)

  return { data: { user: toPublicUser(createdUser), refreshToken: rawRefreshToken }, httpStatus: HttpStatus.CREATED }
}

export async function verifyEmail(input: VerifyEmailInput): Promise<ServiceResult<{ message: string }>> {
  const user = await findUserByEmailVerifyToken(input.token)

  if (!user?.emailVerifyTokenExpiresAt || user.emailVerifyTokenExpiresAt < new Date()) {
    return serviceError(ErrorCode.BAD_REQUEST)
  }

  await markEmailAsVerified(user.id)

  return { data: { message: 'Email verified successfully' }, httpStatus: HttpStatus.OK }
}

export async function loginUser(input: LoginInput): Promise<ServiceResult<{ accessToken: string; refreshToken: string; user: PublicUser }>> {
  const user = await findUserByEmail(input.email)

  if (!user || await isPasswordInvalid(input.password, user.passwordHash)) {
    return serviceError(ErrorCode.UNAUTHORIZED)
  }

  if (!user.emailVerifiedAt) {
    return serviceError(ErrorCode.EMAIL_NOT_VERIFIED)
  }

  if (user.bannedAt) {
    return serviceError(ErrorCode.ACCOUNT_BANNED)
  }

  const { token, jti, expiresAt } = await signJwt(user.id, user.role)
  await storeTokenAndUpdateActivity(jti, user.id, expiresAt)

  const rawRefreshToken = await issueRefreshToken(user.id)

  return { data: { accessToken: token, refreshToken: rawRefreshToken, user: toPublicUser(user) }, httpStatus: HttpStatus.OK }
}

export async function refreshAccessToken(rawToken: string): Promise<ServiceResult<{ accessToken: string; refreshToken: string }>> {
  const tokenHash = hashSha256Hex(rawToken)
  const existingToken = await findRefreshTokenByHash(tokenHash)

  if (!existingToken || existingToken.revokedAt || existingToken.expiresAt < new Date()) {
    return serviceError(ErrorCode.INVALID_REFRESH_TOKEN)
  }

  const user = await findUserById(existingToken.userId)

  if (!user || user.deletedAt) {
    return serviceError(ErrorCode.INVALID_REFRESH_TOKEN)
  }

  if (user.bannedAt) {
    return serviceError(ErrorCode.ACCOUNT_BANNED)
  }

  const { token, jti, expiresAt } = await signJwt(user.id, user.role)
  const newRawRefreshToken = generateRawRefreshToken()

  await rotateRefreshTokenAndIssueAccessToken({
    previousRefreshTokenId: existingToken.id,
    newAccessTokenJti: jti,
    newAccessTokenExpiresAt: expiresAt,
    newRefreshTokenHash: hashSha256Hex(newRawRefreshToken),
    newRefreshTokenExpiresAt: computeRefreshTokenExpiresAt(),
    userId: user.id,
  })

  return { data: { accessToken: token, refreshToken: newRawRefreshToken }, httpStatus: HttpStatus.OK }
}

export async function logoutUser(payload: JwtPayload, userId: string, refreshToken?: string): Promise<ServiceResult<{ message: string }>> {
  if (!payload.jti) {
    return serviceError(ErrorCode.LOGOUT_FAILED)
  }

  const refreshTokenHash = refreshToken ? hashSha256Hex(refreshToken) : undefined

  try {
    await revokeTokenAndUpdateActivity(payload.jti, userId, refreshTokenHash)
    return { data: { message: 'Logged out successfully' }, httpStatus: HttpStatus.OK }
  } catch {
    return serviceError(ErrorCode.LOGOUT_FAILED)
  }
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<ServiceResult<{ message: string; passwordResetToken?: string }>> {
  const genericMessage = 'If this email is registered, a reset link has been sent'
  const user = await findUserByEmail(input.email)

  if (!user?.passwordHash) {
    return { data: { message: genericMessage }, httpStatus: HttpStatus.OK }
  }

  const rawToken = randomBytes(REFRESH_TOKEN_BYTE_LENGTH).toString('hex')
  const tokenHash = hashSha256Hex(rawToken)
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS)

  await setPasswordResetToken(user.id, { passwordResetToken: tokenHash, passwordResetTokenExpiresAt: expiresAt })

  logPasswordResetToken(user.email, rawToken)

  return {
    data: {
      message: genericMessage,
      ...(env.NODE_ENV !== NodeEnvs.PRODUCTION ? { passwordResetToken: rawToken } : {}),
    },
    httpStatus: HttpStatus.OK,
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<ServiceResult<{ message: string }>> {
  const tokenHash = hashSha256Hex(input.passwordResetToken)
  const user = await findUserByPasswordResetToken(tokenHash)

  if (!user?.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt < new Date()) {
    return serviceError(ErrorCode.INVALID_RESET_TOKEN)
  }

  const newPasswordHash = await hashPassword(input.password)

  await resetUserPassword(user.id, {
    passwordHash: newPasswordHash,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
  })

  await deleteAllUserTokens(user.id)

  return { data: { message: 'Password reset successfully' }, httpStatus: HttpStatus.OK }
}

async function isEmailAlreadyTaken(email: string): Promise<boolean> {
  return (await findUserByEmail(email)) !== undefined
}

async function isPasswordInvalid(password: string, hash: string | null): Promise<boolean> {
  return !hash || !(await verifyPassword(password, hash))
}

function sendVerificationEmail(email: string, token: string): void {
  const verifyUrl = new URL(`/auth/verify-email?token=${token}`, env.APP_URL).href

  if (env.NODE_ENV !== NodeEnvs.PRODUCTION) {
    logger.info({ email, verifyUrl }, 'Email verification URL (dev/test)')
    return
  }

  logger.info({ email }, 'Sending verification email via Resend')
}

async function issueRefreshToken(userId: string): Promise<string> {
  const rawToken = generateRawRefreshToken()
  await insertRefreshToken(hashSha256Hex(rawToken), userId, computeRefreshTokenExpiresAt())
  return rawToken
}

function generateRawRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTE_LENGTH).toString('hex')
}

function computeRefreshTokenExpiresAt(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN * 1000)
}

function logPasswordResetToken(email: string, rawToken: string): void {
  if (env.NODE_ENV !== NodeEnvs.PRODUCTION) {
    logger.info({ email, rawToken }, '[DEV] Password reset token')
  }
}
