import type { MiddlewareHandler } from 'hono'
import { ErrorCode } from '../enums/error-code.js'
import { sendError } from '../utils/response.js'
import { verifyJwt } from '../../features/auth/jwt.service.js'
import type { JwtPayload } from '../../features/auth/jwt.service.js'
import { findUserById, updateLastActiveAt } from '../../db/entities/users/users.repository.js'
import { isTokenActive } from '../../db/entities/active-tokens/active-tokens.repository.js'
import { HonoContextKey } from '../enums/context-key.js'
import type { AppVariables } from '../types/app.js'
import { logger } from '../utils/logger.js'

export const authMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (context, next) => {
  const payload = await resolveTokenPayload(context.req.header('Authorization'))

  if (!payload) {
    return sendError(ErrorCode.UNAUTHORIZED)
  }

  if (!payload.jti) {
    return sendError(ErrorCode.UNAUTHORIZED)
  }

  const user = await findUserById(payload.userId)

  if (!user || user.deletedAt) {
    return sendError(ErrorCode.UNAUTHORIZED)
  }

  if (user.bannedAt) {
    return sendError(ErrorCode.ACCOUNT_BANNED)
  }

  const active = await isTokenActive(payload.jti)
  if (!active) {
    return sendError(ErrorCode.UNAUTHORIZED)
  }

  context.set(HonoContextKey.USER, user)
  context.set(HonoContextKey.JWT_PAYLOAD, payload)
  await next()
  void trackLastActiveAt(payload.userId)
  return
}

async function trackLastActiveAt(userId: string): Promise<void> {
  try {
    await updateLastActiveAt(userId)
  } catch (error: unknown) {
    logger.warn({ error }, 'Failed to update last_active_at')
  }
}

async function resolveTokenPayload(authHeader: string | undefined): Promise<JwtPayload | null> {
  const token = extractBearerToken(authHeader)
  if (!token) return null
  return verifyJwt(token)
}

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}
