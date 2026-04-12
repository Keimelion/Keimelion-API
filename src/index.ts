import { serve } from '@hono/node-server'
import { app } from './app.js'
import { env } from './config/env.js'
import { startCronJobs, stopCronJobs } from './cron/index.js'
import { logger } from './shared/utils/logger.js'

const server = serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  () => {
    logger.info({ url: `http://localhost:${String(env.PORT)}`, env: env.NODE_ENV }, 'Server started')
    startCronJobs()
  },
)

const shutdown = () => {
  logger.info('Shutting down...')
  stopCronJobs()
  server.close(() => {
    logger.info('Server closed.')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
