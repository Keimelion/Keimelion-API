import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { LOCALES } from '@keimelion/sdk/enums'
import type { Locale } from '@keimelion/sdk/enums'
import { env } from '../../config/env.js'
import { NodeEnvs } from '../../shared/enums/node-env.js'
import { escapeHtml } from '../../shared/mail/shell/email-shell.html.js'
import { logger } from '../../shared/utils/logger.js'
import { EMAIL_CATALOG, findCatalogEmail } from './email-catalog.js'

const MAIL_PREVIEW_PORT = 3100
const RELOAD_STREAM_PATH = '/__reload'
const KEEP_ALIVE_INTERVAL_MS = 30_000

// `tsx watch` restarts this process on every change: the page reloads once the stream reconnects.
const LIVE_RELOAD_SCRIPT = `<script>
(() => {
  let hasDisconnected = false
  const stream = new EventSource('${RELOAD_STREAM_PATH}')
  stream.onerror = () => { hasDisconnected = true }
  stream.onopen = () => { if (hasDisconnected) location.reload() }
})()
</script>`

if (env.NODE_ENV === NodeEnvs.PRODUCTION) {
  logger.error('The email preview server is a development tool and never runs in production')
  process.exit(1)
}

const previewApp = new Hono()

previewApp.get('/', (context) => context.html(renderIndexPage()))

previewApp.get(RELOAD_STREAM_PATH, (context) =>
  streamSSE(context, async (stream) => {
    while (!stream.aborted) await stream.sleep(KEEP_ALIVE_INTERVAL_MS)
  }),
)

previewApp.get('/:name/:locale', (context) => {
  const email = findCatalogEmail(context.req.param('name'))
  const locale = toLocale(context.req.param('locale'))
  if (email === null || locale === null) return context.notFound()
  return context.html(`${email.render(locale).html}${LIVE_RELOAD_SCRIPT}`)
})

previewApp.get('/:name/:locale/text', (context) => {
  const email = findCatalogEmail(context.req.param('name'))
  const locale = toLocale(context.req.param('locale'))
  if (email === null || locale === null) return context.notFound()
  return context.text(email.render(locale).text)
})

serve({ fetch: previewApp.fetch, port: MAIL_PREVIEW_PORT }, () => {
  logger.info({ url: `http://localhost:${String(MAIL_PREVIEW_PORT)}` }, 'Email preview started')
})

function toLocale(value: string): Locale | null {
  return LOCALES.find((locale) => locale === value) ?? null
}

function renderIndexPage(): string {
  const rows = EMAIL_CATALOG.map((email) => {
    const links = LOCALES.map(
      (locale) =>
        `<a href="/${email.name}/${locale}">${locale.toUpperCase()} HTML</a> · <a href="/${email.name}/${locale}/text">${locale.toUpperCase()} text</a>`,
    ).join(' · ')
    return `<li><strong>${escapeHtml(email.name)}</strong> — ${escapeHtml(email.description)}<br>${links}<br><em>Subject (FR / EN): ${LOCALES.map((locale) => escapeHtml(email.render(locale).subject)).join(' / ')}</em></li>`
  })
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Keimêlion emails</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; line-height: 1.6">
<h1>Keimêlion emails</h1><p>Rendered with sample data. Nothing is sent from this page.</p>
<ul>${rows.join('')}</ul>${LIVE_RELOAD_SCRIPT}</body></html>`
}
