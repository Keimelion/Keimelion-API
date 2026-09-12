import { rateLimiter } from 'hono-rate-limiter'
import type { Context } from 'hono'
import { ErrorCode } from '../enums/error-code.js'
import { sendError } from './response.js'

const ONE_MINUTE_MS = 60 * 1000
const TEN_MINUTES_MS = 10 * 60 * 1000

function ipKeyGenerator(context: Context): string {
  return context.req.header('x-forwarded-for') ?? context.req.header('cf-connecting-ip') ?? 'unknown'
}

export function createRateLimiter(limit: number, windowMs: number = ONE_MINUTE_MS) {
  return rateLimiter({
    windowMs,
    limit,
    standardHeaders: 'draft-6',
    keyGenerator: ipKeyGenerator,
    handler: () => sendError(ErrorCode.RATE_LIMIT_EXCEEDED),
  })
}

// STRICT — hot credential paths: brute-force surface (login, logout, change-password).
// STANDARD — normal writes: signup and admin-triggered mutations.
// SENSITIVE — side-effect-heavy or brute-force-resistant paths: password reset flow, token refresh.
export const RATE_LIMITS = {
  STRICT: () => createRateLimiter(5, ONE_MINUTE_MS),
  STANDARD: () => createRateLimiter(20, ONE_MINUTE_MS),
  SENSITIVE: () => createRateLimiter(10, TEN_MINUTES_MS),
} as const
