import type { MiddlewareHandler } from 'hono'
import { HonoContextKey } from '../enums/context-key.js'
import { logger } from '../utils/logger.js'

export const loggerMiddleware: MiddlewareHandler = async (context, next) => {
  const start = Date.now()
  await next()
  logger.info({
    method: context.req.method,
    path: context.req.path,
    status: context.res.status,
    durationMs: Date.now() - start,
    requestId: context.get(HonoContextKey.REQUEST_ID),
  })
}
