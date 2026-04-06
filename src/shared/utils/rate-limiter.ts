import { rateLimiter } from 'hono-rate-limiter'
import type { Context } from 'hono'
import { ErrorCode } from '../enums/error-code.js'
import { sendError } from './response.js'

const RATE_LIMIT_WINDOW_MS = 60 * 1000

function ipKeyGenerator(context: Context): string {
  return context.req.header('x-forwarded-for') ?? context.req.header('cf-connecting-ip') ?? 'unknown'
}

export function createRateLimiter(limit: number) {
  return rateLimiter({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit,
    standardHeaders: 'draft-6',
    keyGenerator: ipKeyGenerator,
    handler: () => sendError(ErrorCode.RATE_LIMIT_EXCEEDED),
  })
}
