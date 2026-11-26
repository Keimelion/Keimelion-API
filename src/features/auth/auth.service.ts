import { randomUUID, randomBytes } from 'crypto'
import { env } from '../../config/env.js'
import { db } from '../../db/client.js'
import type { DbTransaction } from '../../db/client.js'
import { ErrorCode, HttpStatus } from '@keimelion/sdk/enums'
import type { Locale } from '@keimelion/sdk/enums'
import { NodeEnvs } from '../../shared/enums/node-env.js'
import { sendMailInBackground } from '../../shared/mail/mail.background.js'
import { serviceError } from '../../shared/utils/response.js'
import { readErrorName } from '../../shared/utils/error.js'
import { hashPassword, verifyPassword, hashSha256Hex } from '../../shared/utils/hash.js'
import { logger } from '../../shared/utils/logger.js'
import { ONE_HOUR_MS, ONE_SECOND_MS } from '../../shared/utils/time.js'
import { buildEmailVerificationEmail } from './emails/email-verification.email.js'
import { buildPasswordResetEmail } from './emails/password-reset.email.js'
import { signJwt } from './jwt.service.js'
import type { JwtPayload } from './jwt.service.js'
import {
  findUserByEmail,
  findUserByEmailVerifyToken,
  findUserByPasswordResetToken,
  insertUser,
  markEmailAsVerified,
  renewEmailVerifyToken,
  setPasswordResetToken,
  resetUserPassword,
  updateUserProfile,
} from '../users/users.repository.js'
import { processOptionalImage, runWithImageRollback } from '../uploads/images.service.js'
import { toUserDetail } from '../../shared/types/user.js'
import type { User } from '../../db/entities/users/users.schema.js'
import type { Image } from '../../db/entities/images/images.schema.js'
import {
  storeSessionAndUpdateActivity,
  revokeTokenAndUpdateActivity,
  rotateRefreshTokenAndIssueAccessToken,
} from './auth.repository.js'
import { deleteAllUserTokens } from '../../db/entities/access-tokens/access-tokens.repository.js'
import { findRefreshTokenByHash } from '../../db/entities/refresh-tokens/refresh-tokens.repository.js'
import { findUserById } from '../../db/entities/users/users.repository.js'
import { isEmailVerificationOverdue } from '../../db/entities/users/users.email-verification.js'
import { RESEND_VERIFICATION_COOLDOWN_SECONDS } from '@keimelion/sdk/schemas'
import type {
  ForgotPasswordRequestParsed,
  ForgotPasswordResponseParsed,
  LoginRequestParsed,
  LoginResponseParsed,
  LogoutResponseParsed,
  RefreshResponseParsed,
  RegisterRequestParsed,
  RegisterResponseParsed,
  ResendVerificationRequestParsed,
  ResendVerificationResponseParsed,
  ResetPasswordRequestParsed,
  ResetPasswordResponseParsed,
  VerifyEmailRequestParsed,
  VerifyEmailResponseParsed,
} from '@keimelion/sdk/schemas'
import type { ServiceResult } from '../../shared/types/service.js'

const PASSWORD_RESET_TOKEN_TTL_HOURS = 1
const REFRESH_TOKEN_BYTE_LENGTH = 32
const PASSWORD_RESET_GENERIC_MESSAGE = 'If this email is registered, a reset link has been sent'
const VERIFICATION_RESEND_GENERIC_MESSAGE =
  'If this email belongs to an account awaiting verification, a new verification link has been sent'
const VERIFICATION_RESEND_COOLDOWN_MS = RESEND_VERIFICATION_COOLDOWN_SECONDS * ONE_SECOND_MS
const EMAIL_VERIFIED_MESSAGE = 'Email verified successfully'
const EMAIL_ALREADY_VERIFIED_MESSAGE = 'Email already verified'
const VERIFICATION_EMAIL_FAILED_EVENT = 'auth_verification_email_failed'
const VERIFICATION_RESEND_FAILED_EVENT = 'auth_verification_resend_failed'
const PASSWORD_RESET_EMAIL_FAILED_EVENT = 'auth_password_reset_email_failed'
const PASSWORD_RESET_FAILED_EVENT = 'auth_password_reset_failed'

export async function registerUser(
  input: RegisterRequestParsed,
  emailLocale: Locale,
  avatarBuffer: Buffer | null = null,
): Promise<ServiceResult<RegisterResponseParsed>> {
  if (await isEmailAlreadyTaken(input.email)) {
    return serviceError(ErrorCode.CONFLICT)
  }

  const emailVerifyToken = randomUUID()
  // Account and session commit together: a failed session never leaves an account the client
  // cannot sign in to, nor a 409 on its retry.
  const registration = await db.transaction(async (tx) => {
    const createdUser = await insertUser(input, emailVerifyToken, null, tx)
    if (!createdUser) return null
    return openSession(createdUser, tx)
  })

  if (!registration) {
    return serviceError(ErrorCode.USER_CREATION_FAILED)
  }

  sendVerificationEmail(input.email, emailVerifyToken, emailLocale)

  const finalUser = await maybeAttachAvatar(registration.user, avatarBuffer)
  if ('errorCode' in finalUser) return serviceError(finalUser.errorCode)

  return {
    data: {
      ...registration.tokens,
      user: toUserDetail({ ...finalUser.row, avatarImage: finalUser.avatarImage }),
    },
    httpStatus: HttpStatus.CREATED,
  }
}

interface AvatarAttachOutcome {
  row: User
  avatarImage: Image | null
}

async function maybeAttachAvatar(
  createdUser: User,
  avatarBuffer: Buffer | null,
): Promise<AvatarAttachOutcome | { errorCode: ErrorCode }> {
  const imageOutcome = await processOptionalImage(avatarBuffer, createdUser.id)
  if ('errorCode' in imageOutcome) return { errorCode: imageOutcome.errorCode }
  if (!imageOutcome.image) return { row: createdUser, avatarImage: null }

  const avatarImageId = imageOutcome.image.id
  const updated = await runWithImageRollback(avatarImageId, 'auth.register_avatar', () =>
    updateUserProfile(createdUser.id, { avatarImageId }),
  )
  if (!updated) return { errorCode: ErrorCode.USER_UPDATE_FAILED }
  return { row: updated, avatarImage: imageOutcome.image }
}

export async function verifyEmail(input: VerifyEmailRequestParsed): Promise<ServiceResult<VerifyEmailResponseParsed>> {
  const user = await findUserByEmailVerifyToken(input.token)

  if (!user || !isEmailVerifyLinkUsable(user, new Date())) {
    return serviceError(ErrorCode.BAD_REQUEST)
  }

  const isNewlyVerified = user.emailVerifiedAt === null && await markEmailAsVerified(user.id)

  return {
    data: {
      message: isNewlyVerified ? EMAIL_VERIFIED_MESSAGE : EMAIL_ALREADY_VERIFIED_MESSAGE,
      userId: user.id,
      alreadyVerified: !isNewlyVerified,
    },
    httpStatus: HttpStatus.OK,
  }
}

export async function resendVerificationEmail(
  input: ResendVerificationRequestParsed,
  emailLocale: Locale,
): Promise<ServiceResult<ResendVerificationResponseParsed & { emailVerifyToken?: string }>> {
  const rawToken = randomUUID()
  const verificationResend = issueVerificationResend(input.email, rawToken, emailLocale)

  if (env.NODE_ENV === NodeEnvs.PRODUCTION) {
    return { data: { message: VERIFICATION_RESEND_GENERIC_MESSAGE }, httpStatus: HttpStatus.OK }
  }

  // Outside production the token is returned: it must be stored before the client can use it
  if (!(await verificationResend)) {
    return { data: { message: VERIFICATION_RESEND_GENERIC_MESSAGE }, httpStatus: HttpStatus.OK }
  }
  return {
    data: { message: VERIFICATION_RESEND_GENERIC_MESSAGE, emailVerifyToken: rawToken },
    httpStatus: HttpStatus.OK,
  }
}

export async function loginUser(input: LoginRequestParsed): Promise<ServiceResult<LoginResponseParsed>> {
  const user = await findUserByEmail(input.email)

  if (!user || await isPasswordInvalid(input.password, user.passwordHash)) {
    return serviceError(ErrorCode.UNAUTHORIZED)
  }

  const sessionDenial = resolveSessionDenial(user)
  if (sessionDenial) {
    return serviceError(sessionDenial)
  }

  const session = await openSession(user)
  return { data: { ...session.tokens, user: toUserDetail(session.user) }, httpStatus: HttpStatus.OK }
}

export async function refreshAccessToken(rawToken: string): Promise<ServiceResult<RefreshResponseParsed>> {
  const tokenHash = hashSha256Hex(rawToken)
  const existingToken = await findRefreshTokenByHash(tokenHash)

  if (!existingToken || existingToken.revokedAt || existingToken.expiresAt < new Date()) {
    return serviceError(ErrorCode.INVALID_REFRESH_TOKEN)
  }

  const user = await findUserById(existingToken.userId)

  if (!user || user.deletedAt) {
    return serviceError(ErrorCode.INVALID_REFRESH_TOKEN)
  }

  const sessionDenial = resolveSessionDenial(user)
  if (sessionDenial) {
    return serviceError(sessionDenial)
  }

  const { token, tokenId, expiresAt } = await signJwt(user.id, user.role)
  const newRawRefreshToken = generateRawRefreshToken()

  await rotateRefreshTokenAndIssueAccessToken({
    previousRefreshTokenId: existingToken.id,
    newAccessTokenId: tokenId,
    newAccessTokenExpiresAt: expiresAt,
    newRefreshTokenHash: hashSha256Hex(newRawRefreshToken),
    newRefreshTokenExpiresAt: computeRefreshTokenExpiresAt(),
    userId: user.id,
  })

  return { data: { accessToken: token, refreshToken: newRawRefreshToken }, httpStatus: HttpStatus.OK }
}

export async function logoutUser(payload: JwtPayload, userId: string, refreshToken?: string): Promise<ServiceResult<LogoutResponseParsed>> {
  if (!payload.tokenId) {
    return serviceError(ErrorCode.LOGOUT_FAILED)
  }

  const refreshTokenHash = refreshToken ? hashSha256Hex(refreshToken) : undefined

  try {
    await revokeTokenAndUpdateActivity(payload.tokenId, userId, refreshTokenHash)
    return { data: { message: 'Logged out successfully' }, httpStatus: HttpStatus.OK }
  } catch {
    return serviceError(ErrorCode.LOGOUT_FAILED)
  }
}

export async function requestPasswordReset(
  input: ForgotPasswordRequestParsed,
  emailLocale: Locale,
): Promise<ServiceResult<ForgotPasswordResponseParsed & { passwordResetToken?: string }>> {
  const user = await findUserByEmail(input.email)

  if (!user?.passwordHash) {
    return { data: { message: PASSWORD_RESET_GENERIC_MESSAGE }, httpStatus: HttpStatus.OK }
  }

  const rawToken = randomBytes(REFRESH_TOKEN_BYTE_LENGTH).toString('hex')
  const passwordReset = issuePasswordReset(user, rawToken, emailLocale)

  if (env.NODE_ENV === NodeEnvs.PRODUCTION) {
    return { data: { message: PASSWORD_RESET_GENERIC_MESSAGE }, httpStatus: HttpStatus.OK }
  }

  // Outside production the token is returned: it must be stored before the client can use it
  await passwordReset
  return {
    data: { message: PASSWORD_RESET_GENERIC_MESSAGE, passwordResetToken: rawToken },
    httpStatus: HttpStatus.OK,
  }
}

export async function resetPassword(input: ResetPasswordRequestParsed): Promise<ServiceResult<ResetPasswordResponseParsed>> {
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

// The token survives the verification until it expires; a deleted account never answers.
function isEmailVerifyLinkUsable(user: User, now: Date): boolean {
  if (user.deletedAt || !user.emailVerifyTokenExpiresAt) return false
  return user.emailVerifyTokenExpiresAt >= now
}

async function isPasswordInvalid(password: string, hash: string | null): Promise<boolean> {
  return !hash || !(await verifyPassword(password, hash))
}

function sendVerificationEmail(email: string, verifyToken: string, locale: Locale): void {
  sendMailInBackground(VERIFICATION_EMAIL_FAILED_EVENT, () => ({
    to: email,
    ...buildEmailVerificationEmail({
      locale,
      verifyToken,
      validityHours: env.EMAIL_VERIFY_TOKEN_TTL_HOURS,
    }),
  }))
}

// Never rejects. In production it runs after the response is sent: an account awaiting verification
// answers as fast as an unknown, verified or cooling-down one. Resolves whether a link was sent.
async function issueVerificationResend(email: string, rawToken: string, locale: Locale): Promise<boolean> {
  try {
    const lastIssuedBefore = new Date(Date.now() - VERIFICATION_RESEND_COOLDOWN_MS)
    const isRenewed = await renewEmailVerifyToken(email, rawToken, lastIssuedBefore)
    if (isRenewed) sendVerificationEmail(email, rawToken, locale)
    return isRenewed
  } catch (error) {
    logger.error({ event: VERIFICATION_RESEND_FAILED_EVENT, errorName: readErrorName(error) })
    return false
  }
}

// Same precedence as the account status: a banned account is reported as banned even unverified.
// An unverified account opens sessions until its email verification deadline.
function resolveSessionDenial(user: User): ErrorCode | null {
  if (user.bannedAt) return ErrorCode.ACCOUNT_BANNED
  if (isEmailVerificationOverdue(user, new Date())) return ErrorCode.EMAIL_NOT_VERIFIED
  return null
}

// Never rejects. In production it runs after the response is sent: an existing account answers as
// fast as an unknown address.
async function issuePasswordReset(user: User, rawToken: string, locale: Locale): Promise<void> {
  try {
    await setPasswordResetToken(user.id, {
      passwordResetToken: hashSha256Hex(rawToken),
      passwordResetTokenExpiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_HOURS * ONE_HOUR_MS),
    })
    sendMailInBackground(PASSWORD_RESET_EMAIL_FAILED_EVENT, () => ({
      to: user.email,
      ...buildPasswordResetEmail({
        locale,
        role: user.role,
        resetToken: rawToken,
        validityHours: PASSWORD_RESET_TOKEN_TTL_HOURS,
      }),
    }))
  } catch (error) {
    logger.error({ event: PASSWORD_RESET_FAILED_EVENT, errorName: readErrorName(error) })
  }
}

interface OpenedSession<TUser extends User> {
  tokens: RefreshResponseParsed
  user: TUser
}

// The returned user carries the activity just recorded (lastActiveAt, userStatus).
async function openSession<TUser extends User>(user: TUser, tx?: DbTransaction): Promise<OpenedSession<TUser>> {
  const { token, tokenId, expiresAt } = await signJwt(user.id, user.role)
  const refreshToken = generateRawRefreshToken()
  const updatedUser = await storeSessionAndUpdateActivity(
    user.id,
    {
      accessTokenId: tokenId,
      accessTokenExpiresAt: expiresAt,
      refreshTokenHash: hashSha256Hex(refreshToken),
      refreshTokenExpiresAt: computeRefreshTokenExpiresAt(),
    },
    tx,
  )
  return { tokens: { accessToken: token, refreshToken }, user: { ...user, ...updatedUser } }
}

function generateRawRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTE_LENGTH).toString('hex')
}

function computeRefreshTokenExpiresAt(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN * 1000)
}
