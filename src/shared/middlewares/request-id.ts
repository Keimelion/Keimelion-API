import { requestId } from 'hono/request-id'
import type { MiddlewareHandler } from 'hono'
import { HonoContextKey } from '../enums/context-key.js'

export const requestIdMiddleware: MiddlewareHandler = async (context, next) => {
  await requestId()(context, async () => {
    await next()
    const id = context.get(HonoContextKey.REQUEST_ID)
    if (id) {
      context.res.headers.set('X-Request-Id', id)
    }
  })
}
