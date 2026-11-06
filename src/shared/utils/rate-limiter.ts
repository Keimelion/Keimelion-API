import { rateLimiter } from 'hono-rate-limiter'
import { bodyLimit } from 'hono/body-limit'
import type { Context, MiddlewareHandler, Next } from 'hono'
import { ErrorCode } from '@keimelion/sdk/enums'
import type { ApiErrorBodyParsed } from '@keimelion/sdk/schemas'
import { HonoContextKey } from '../enums/context-key.js'
import { env } from '../../config/env.js'
import { errorMap, sendError } from './response.js'
import type { AppVariables } from '../types/app.js'
import type { User } from '../../db/entities/users/users.schema.js'

const ONE_MINUTE_MS = 60 * 1000
const TEN_MINUTES_MS = 10 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000
const MULTIPART_FIELDS_OVERHEAD_BYTES = 64 * 1024

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
// UPLOAD — image uploads: expensive (sharp decode + webp encode × 3) and disk-bound; tighter than STANDARD.
// PUBLIC — unauthenticated reads (shared wishlists by slug). Tighter than STANDARD because the
// anonymous surface is a scraping target; still high enough for a human browsing one list.
export const RATE_LIMITS = {
  STRICT: () => createRateLimiter(5, ONE_MINUTE_MS),
  STANDARD: () => createRateLimiter(20, ONE_MINUTE_MS),
  SENSITIVE: () => createRateLimiter(10, TEN_MINUTES_MS),
  UPLOAD: () => createRateLimiter(10, ONE_MINUTE_MS),
  PUBLIC: () => createRateLimiter(10, ONE_MINUTE_MS),
} as const

// Picks the limiter according to the caller's auth state. Must be mounted AFTER
// optionalAuthMiddleware so that HonoContextKey.USER is populated.
export function authAwareRateLimiter(
  authenticated: MiddlewareHandler,
  anonymous: MiddlewareHandler,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (context, next) => {
    const user = context.get(HonoContextKey.USER) as User | undefined
    const limiter = user ? authenticated : anonymous
    return limiter(context, next)
  }
}

const uploadBodyLimit = bodyLimit({
  maxSize: env.UPLOADS_MAX_SIZE_BYTES + MULTIPART_FIELDS_OVERHEAD_BYTES,
  onError: () => sendError(ErrorCode.PAYLOAD_TOO_LARGE),
})

// Multipart upload routes: the given middleware (typically RATE_LIMITS.UPLOAD) runs first, then the
// body size cap rejects oversized bodies before Hono's parseBody buffers them in memory.
export function multipartOnly(middleware: MiddlewareHandler): MiddlewareHandler {
  return async (context, next) => {
    const contentType = context.req.header('Content-Type') ?? ''
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) return next()
    return middleware(context, () => runUploadBodyLimit(context, next))
  }
}

async function runUploadBodyLimit(
  context: Parameters<MiddlewareHandler>[0],
  next: Next,
): Promise<void> {
  const outcome: unknown = await uploadBodyLimit(context, next)
  if (outcome instanceof Response) context.res = outcome
}

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
function jsonRateLimitHandler(context: Context): Response {
  const { status, message } = errorMap[ErrorCode.RATE_LIMIT_EXCEEDED]
  const body: ApiErrorBodyParsed = { message, code: ErrorCode.RATE_LIMIT_EXCEEDED, metadata: {} }
  return context.json(body, status)
}

export function createFeedbackRateLimiters(): [MiddlewareHandler, MiddlewareHandler] {
  return [
    rateLimiter({
      windowMs: ONE_MINUTE_MS,
      limit: env.FEEDBACK_RATE_LIMIT_PER_MINUTE,
      standardHeaders: 'draft-6',
      keyGenerator: feedbackKeyGenerator('feedback:min'),
      handler: jsonRateLimitHandler,
    }),
    rateLimiter({
      windowMs: ONE_HOUR_MS,
      limit: env.FEEDBACK_RATE_LIMIT_PER_HOUR,
      standardHeaders: 'draft-6',
      keyGenerator: feedbackKeyGenerator('feedback:hour'),
      handler: jsonRateLimitHandler,
    }),
  ]
}

// Keyed on user.id: the route is authenticated, so a single account cannot bypass by rotating
// IPs. Must be mounted AFTER authMiddleware so that HonoContextKey.USER is populated.
function reportKeyGenerator(prefix: string): (context: Context<{ Variables: AppVariables }>) => string {
  return (context) => `${prefix}:user:${context.get(HonoContextKey.USER).id}`
}

export function createReportRateLimiters(): [MiddlewareHandler, MiddlewareHandler] {
  return [
    rateLimiter({
      windowMs: ONE_MINUTE_MS,
      limit: env.REPORT_RATE_LIMIT_PER_MINUTE,
      standardHeaders: 'draft-6',
      keyGenerator: reportKeyGenerator('report:min'),
      handler: jsonRateLimitHandler,
    }),
    rateLimiter({
      windowMs: ONE_HOUR_MS,
      limit: env.REPORT_RATE_LIMIT_PER_HOUR,
      standardHeaders: 'draft-6',
      keyGenerator: reportKeyGenerator('report:hour'),
      handler: jsonRateLimitHandler,
    }),
  ]
}
