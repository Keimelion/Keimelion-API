import pino from 'pino'
import { env } from '../../config/env.js'
import { NodeEnvs } from '../enums/node-env.js'

const isProduction = env.NODE_ENV === NodeEnvs.PRODUCTION

export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }),
})
