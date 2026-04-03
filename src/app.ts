import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { env } from './config/env.js'
import { requestIdMiddleware } from './middlewares/request-id.js'
import { rateLimitMiddleware } from './middlewares/rate-limit.js'
import { loggerMiddleware } from './middlewares/logger.js'
import { mountRoutes } from './routes/index.js'
import { ErrorCode } from './types/errors.js'
import { HttpMethod, HttpHeader } from './types/http.js'
import { sendError } from './utils/response.js'
import { logger } from './utils/logger.js'

const CORS_ALLOW_METHODS = [HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE, HttpMethod.OPTIONS]
const CORS_ALLOW_HEADERS = [HttpHeader.CONTENT_TYPE, HttpHeader.AUTHORIZATION]

export const app = new Hono()

// 1. Request ID — must be first so all subsequent logs include the ID
app.use('*', requestIdMiddleware)

// 2. Secure HTTP headers
app.use('*', secureHeaders())

// 3. Rate limiter
app.use('*', rateLimitMiddleware)

// 4. Structured request logger
app.use('*', loggerMiddleware)

// 5. CORS
app.use(
  '*',
  cors({
    origin: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    allowMethods: CORS_ALLOW_METHODS,
    allowHeaders: CORS_ALLOW_HEADERS,
    credentials: true,
  }),
)

// Routes
mountRoutes(app)

// 404 — must be after routes
app.notFound((context) => sendError(ErrorCode.NOT_FOUND, { path: context.req.path }))

// Global error handler
app.onError((err, _c) => {
  logger.error({ err }, 'Unhandled error')
  return sendError(ErrorCode.INTERNAL_ERROR)
})
