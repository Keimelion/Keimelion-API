import type { Context, MiddlewareHandler } from 'hono'
import { verifyJwt } from '../../features/auth/jwt.service.js'
import type { JwtPayload } from '../../features/auth/jwt.service.js'
import { findUserById, updateLastActiveAt } from '../../db/entities/users/users.repository.js'
import { isTokenActive } from '../../db/entities/access-tokens/access-tokens.repository.js'
import { HonoContextKey } from '../enums/context-key.js'
import type { AppVariables } from '../types/app.js'
import type { User } from '../../db/entities/users/users.schema.js'
import { logger } from '../utils/logger.js'

export function getOptionalAuthUser(context: Context<{ Variables: AppVariables }>): User | null {
  const user = context.get(HonoContextKey.USER) as User | undefined
  return user ?? null
}

export const optionalAuthMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (context, next) => {
  const user = await resolveOptionalUser(context.req.header('Authorization'))

  if (user) {
    context.set(HonoContextKey.USER, user)
    await next()
    void trackLastActiveAt(user.id)
    return
  }

  await next()
  return
}

async function trackLastActiveAt(userId: string): Promise<void> {
  try {
    await updateLastActiveAt(userId)
  } catch (error: unknown) {
    logger.warn({ error }, 'Failed to update last_active_at')
  }
}

async function resolveOptionalUser(authHeader: string | undefined): Promise<User | null> {
  const payload = await resolveTokenPayload(authHeader)
  if (!payload?.tokenId) return null

  const user = await findUserById(payload.userId)
  if (!user || user.deletedAt || user.bannedAt) return null

  const active = await isTokenActive(payload.tokenId)
  if (!active) return null

  return user
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
