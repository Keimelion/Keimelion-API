import { randomUUID } from 'crypto'
import { env } from '../../config/env.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { verifyPassword } from '../../shared/utils/hash.js'
import { logger } from '../../shared/utils/logger.js'
import { signJwt } from './jwt.service.js'
import type { JwtPayload } from './jwt.service.js'
import { findUserByEmail, findUserByEmailVerifyToken, insertUser, markEmailAsVerified, updateLastActiveAt } from '../users/users.repository.js'
import { toPublicUser } from '../users/users.mapper.js'
import { blacklistTokenAndUpdateActivity } from './auth.repository.js'
import type { PublicUser } from '../users/users.mapper.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { RegisterInput } from './endpoints/register.js'
import type { VerifyEmailInput } from './endpoints/verify-email.js'
import type { LoginInput } from './endpoints/login.js'


export async function registerUser(input: RegisterInput): Promise<ServiceResult<{ user: PublicUser }>> {
  if (await isEmailAlreadyTaken(input.email)) {
    return serviceError(ErrorCode.CONFLICT)
  }

  const emailVerifyToken = randomUUID()
  const createdUser = await insertUser(input, emailVerifyToken)

  if (!createdUser) {
    return serviceError(ErrorCode.USER_CREATION_FAILED)
  }

  sendVerificationEmail(input.email, emailVerifyToken)

  return { data: { user: toPublicUser(createdUser) }, httpStatus: HttpStatus.CREATED }
}

export async function verifyEmail(input: VerifyEmailInput): Promise<ServiceResult<{ message: string }>> {
  const user = await findUserByEmailVerifyToken(input.token)

  if (!user?.emailVerifyTokenExpiresAt || user.emailVerifyTokenExpiresAt < new Date()) {
    return serviceError(ErrorCode.BAD_REQUEST)
  }

  await markEmailAsVerified(user.id)

  return { data: { message: 'Email verified successfully' }, httpStatus: HttpStatus.OK }
}

export async function loginUser(input: LoginInput): Promise<ServiceResult<{ token: string; user: PublicUser }>> {
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

  const token = await signJwt(user.id, user.role)
  await updateLastActiveAt(user.id)

  return { data: { token, user: toPublicUser(user) }, httpStatus: HttpStatus.OK }
}

export async function logoutUser(payload: JwtPayload, userId: string): Promise<ServiceResult<null>> {
  if (!payload.jti || !payload.exp) {
    return serviceError(ErrorCode.LOGOUT_FAILED)
  }

  try {
    await blacklistTokenAndUpdateActivity({
      jti: payload.jti,
      expiresAt: new Date(payload.exp * 1000),
      userId,
    })
    return { data: null, httpStatus: HttpStatus.NO_CONTENT }
  } catch {
    return serviceError(ErrorCode.LOGOUT_FAILED)
  }
}

function sendVerificationEmail(email: string, token: string): void {
  const verifyUrl = new URL(`/auth/verify-email?token=${token}`, env.APP_URL).href

  if (env.NODE_ENV !== 'production') {
    logger.info({ email, verifyUrl }, 'Email verification URL (dev/test)')
    return
  }

  logger.info({ email }, 'Sending verification email via Resend')
}

async function isEmailAlreadyTaken(email: string): Promise<boolean> {
  return (await findUserByEmail(email)) !== undefined
}

async function isPasswordInvalid(password: string, hash: string | null): Promise<boolean> {
  return !hash || !(await verifyPassword(password, hash))
}
