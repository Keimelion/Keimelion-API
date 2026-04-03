import { rateLimiter } from 'hono-rate-limiter'
import { env } from '../config/env.js'
import { ErrorCode } from '../types/errors.js'
import { sendError } from '../utils/response.js'

export const rateLimitMiddleware = rateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-6',
  keyGenerator: (context) =>
    context.req.header('x-forwarded-for') ?? context.req.header('cf-connecting-ip') ?? 'unknown',
  handler: () => sendError(ErrorCode.RATE_LIMIT_EXCEEDED),
})

