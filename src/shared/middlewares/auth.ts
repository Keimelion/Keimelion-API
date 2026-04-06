import type { MiddlewareHandler } from 'hono'
import { ErrorCode } from '../enums/error-code.js'
import { sendError } from '../utils/response.js'
import { verifyJwt } from '../../features/auth/jwt.service.js'
import type { JwtPayload } from '../../features/auth/jwt.service.js'
import { findUserById } from '../../features/users/users.repository.js'
import type { AppVariables } from '../types/app.js'

export const authMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (context, next) => {
  const payload = await resolveTokenPayload(context.req.header('Authorization'))

  if (!payload) {
    return sendError(ErrorCode.UNAUTHORIZED)
  }

  const user = await findUserById(payload.userId)

  if (!user || user.deletedAt) {
    return sendError(ErrorCode.UNAUTHORIZED)
  }

  if (user.bannedAt) {
    return sendError(ErrorCode.ACCOUNT_BANNED)
  }

  context.set('user', user)
  return next()
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
