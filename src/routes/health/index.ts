import { Hono } from 'hono'
import { checkHealth } from '../../services/health.service.js'

export const healthRouter = new Hono()

healthRouter.get('/', async (c) => {
  const { data, httpStatus } = await checkHealth()
  return c.json(data, httpStatus)
})
