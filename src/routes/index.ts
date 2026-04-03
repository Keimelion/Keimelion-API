import { Hono } from 'hono'
import { healthRouter } from './health/index.js'

export function mountRoutes(app: Hono): void {
  const v1 = new Hono()
  v1.route('/health', healthRouter)
  app.route('/v1', v1)
}
