import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { serveStatic } from '@hono/node-server/serve-static'
import { env } from './config/env.js'
import { requestIdMiddleware } from './shared/middlewares/request-id.js'
import { rateLimitMiddleware } from './shared/middlewares/rate-limit.js'
import { loggerMiddleware } from './shared/middlewares/logger.js'
import { resolveLocaleMiddleware } from './shared/middlewares/resolve-locale.js'
import { mountRoutes } from './features/index.js'
import { ErrorCode, HttpHeader, HttpMethod, HttpStatus } from '@keimelion/sdk/enums'
import { NodeEnvs } from './shared/enums/node-env.js'
import { sendError } from './shared/utils/response.js'
import { logger } from './shared/utils/logger.js'
import { MAIL_ASSETS_DIR, MAIL_ASSETS_ROUTE } from './shared/mail/shell/email-shell.assets.js'

// Emails stay in inboxes for years: a file changed in place would also change old emails, so a
// redesign ships new file names rather than relying on this cache expiring.
const MAIL_ASSETS_CACHE_CONTROL = 'public, max-age=604800'

const CORS_ALLOW_METHODS = [HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE, HttpMethod.OPTIONS]
const CORS_ALLOW_HEADERS = [HttpHeader.CONTENT_TYPE, HttpHeader.AUTHORIZATION]

export const app = new Hono()

// 1. Request ID — must be first so all subsequent logs include the ID
app.use('*', requestIdMiddleware)

// 1b. CORP override for dev-only /uploads/* — secureHeaders sets
// Cross-Origin-Resource-Policy: same-origin on every response AFTER next(),
// which would prevent the BackOffice (:3001) from loading images from the
// API (:3000) via <img>. Registering this middleware BEFORE secureHeaders
// means on the response ascent it runs LAST, overwriting secureHeaders' value.
// Dev-only: in production nginx serves /uploads/* without this header.
if (env.NODE_ENV !== NodeEnvs.PRODUCTION) {
  app.use('/uploads/*', async (c, next) => {
    await next()
    c.res.headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
  })
}

// 1c. Email images, in every environment (Caddy only serves /uploads/*). Mounted before the
// secure headers and the rate limiter: mail clients and their image proxies load them from any
// origin, and one recipient's inbox can fetch them many times.
app.use(
  `${MAIL_ASSETS_ROUTE}/*`,
  async (c, next) => {
    await next()
    if (!c.res.ok) return
    c.res.headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
    c.res.headers.set('Cache-Control', MAIL_ASSETS_CACHE_CONTROL)
  },
  serveStatic({
    root: MAIL_ASSETS_DIR,
    rewriteRequestPath: (path) => path.slice(MAIL_ASSETS_ROUTE.length),
  }),
)

// 2. Secure HTTP headers
app.use('*', secureHeaders())

// 3. Rate limiter
app.use('*', rateLimitMiddleware)

// 4. Structured request logger
app.use('*', loggerMiddleware)

// 5. Locale resolution — sets locale on context for all request handlers
app.use('*', resolveLocaleMiddleware)

// 6. CORS
app.use(
  '*',
  cors({
    origin: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    allowMethods: CORS_ALLOW_METHODS,
    allowHeaders: CORS_ALLOW_HEADERS,
    credentials: true,
  }),
)

// 7. Dev-only static mount for uploaded image variants. In production, nginx
// serves /uploads/* directly before Hono (see KEI-123 tech notes), so this
// middleware stays gated to avoid shadowing it.
if (env.NODE_ENV !== NodeEnvs.PRODUCTION) {
  app.use(
    '/uploads/*',
    serveStatic({
      root: env.UPLOADS_DIR,
      rewriteRequestPath: (path) => path.replace(/^\/uploads/, ''),
    }),
  )
}

// Routes
mountRoutes(app)

// 404 — must be after routes
app.notFound((context) => sendError(ErrorCode.NOT_FOUND, { path: context.req.path }))

// Global error handler
app.onError((err, _c) => {
  // Hono's validator throws a 400 HTTPException on a malformed JSON body
  if (err instanceof HTTPException && err.status === HttpStatus.BAD_REQUEST) {
    return sendError(ErrorCode.BAD_REQUEST)
  }
  logger.error({ err }, 'Unhandled error')
  return sendError(ErrorCode.INTERNAL_ERROR)
})
