import { requestId } from 'hono/request-id'
import type { MiddlewareHandler } from 'hono'

export const requestIdMiddleware: MiddlewareHandler = async (context, next) => {
  await requestId()(context, async () => {
    await next()
    const id = context.get('requestId')
    if (id) {
      context.res.headers.set('X-Request-Id', id)
    }
  })
}
