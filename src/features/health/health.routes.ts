import { Hono } from 'hono'
import { mountGetHealth } from './endpoints/get-health.js'

export const healthRouter = new Hono()
mountGetHealth(healthRouter)
