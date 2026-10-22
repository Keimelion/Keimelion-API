import { rateLimiter } from 'hono-rate-limiter'
import type { Context, MiddlewareHandler } from 'hono'
import { ErrorCode } from '../enums/error-code.js'
import { HonoContextKey } from '../enums/context-key.js'
import { env } from '../../config/env.js'
import { errorMap, sendError } from './response.js'
import type { ApiError } from '../types/api.js'
import type { AppVariables } from '../types/app.js'
import type { User } from '../../db/entities/users/users.schema.js'

const ONE_MINUTE_MS = 60 * 1000
const TEN_MINUTES_MS = 10 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000

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

// Per-user when authenticated (keyed on user.id so a single account cannot bypass by rotating IPs),
// per-IP for anonymous callers. Must be mounted AFTER optionalAuthMiddleware so that
// HonoContextKey.USER is populated.
function feedbackKeyGenerator(prefix: string): (context: Context<{ Variables: AppVariables }>) => string {
  return (context) => {
    // optionalAuthMiddleware may skip setting USER when the request is anonymous,
    // so the typed value can be undefined at runtime despite the AppVariables shape.
    const user = context.get(HonoContextKey.USER) as User | undefined
    if (user) return `${prefix}:user:${user.id}`
    return `${prefix}:ip:${ipKeyGenerator(context)}`
  }
}

// Uses context.json(...) so RateLimit-* and Retry-After headers set by hono-rate-limiter
// via c.header(...) are merged into the final response.
function feedbackRateLimitHandler(context: Context): Response {
  const { status, message } = errorMap[ErrorCode.RATE_LIMIT_EXCEEDED]
  const body: ApiError = { message, code: ErrorCode.RATE_LIMIT_EXCEEDED, metadata: {} }
  return context.json(body, status)
}

export function createFeedbackRateLimiters(): [MiddlewareHandler, MiddlewareHandler] {
  return [
    rateLimiter({
      windowMs: ONE_MINUTE_MS,
      limit: env.FEEDBACK_RATE_LIMIT_PER_MINUTE,
      standardHeaders: 'draft-6',
      keyGenerator: feedbackKeyGenerator('feedback:min'),
      handler: feedbackRateLimitHandler,
    }),
    rateLimiter({
      windowMs: ONE_HOUR_MS,
      limit: env.FEEDBACK_RATE_LIMIT_PER_HOUR,
      standardHeaders: 'draft-6',
      keyGenerator: feedbackKeyGenerator('feedback:hour'),
      handler: feedbackRateLimitHandler,
    }),
  ]
}
