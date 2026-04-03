import { serve } from '@hono/node-server'
import { app } from './app.js'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'

const server = serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  () => {
    logger.info({ url: `http://localhost:${String(env.PORT)}`, env: env.NODE_ENV }, 'Server started')
  },
)

const shutdown = () => {
  logger.info('Shutting down...')
  server.close(() => {
    logger.info('Server closed.')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
