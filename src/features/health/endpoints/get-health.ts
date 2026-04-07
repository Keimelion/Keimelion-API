import type { Hono } from 'hono'
import { checkHealth } from '../health.service.js'

export function mountGetHealth(router: Hono): void {
  router.get('/', async (context) => {
    const { data, httpStatus } = await checkHealth()
    return context.json(data, httpStatus)
  })
}
