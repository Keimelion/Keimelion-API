import type { Context, MiddlewareHandler } from 'hono'
import { DEFAULT_LOCALE } from '@keimelion/sdk/enums'
import type { Locale } from '@keimelion/sdk/enums'
import { HonoContextKey } from '../enums/context-key.js'
import type { AppVariables } from '../types/app.js'
import { matchAcceptLanguage } from '../utils/locale.js'

export const resolveLocaleMiddleware: MiddlewareHandler = async (context, next) => {
  const locale = matchAcceptLanguage(context.req.header('Accept-Language')) ?? DEFAULT_LOCALE
  context.set(HonoContextKey.LOCALE, locale)
  await next()
}

export function getLocale(context: Context<{ Variables: AppVariables }>): Locale {
  return context.get(HonoContextKey.LOCALE)
}
