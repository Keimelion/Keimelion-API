import type { Context, MiddlewareHandler } from 'hono'
import { LOCALES, DEFAULT_LOCALE } from '../enums/locale.js'
import { HonoContextKey } from '../enums/context-key.js'
import type { Locale } from '../enums/locale.js'
import type { AppVariables } from '../types/app.js'

export const resolveLocaleMiddleware: MiddlewareHandler = async (context, next) => {
  const locale = parseAcceptLanguage(context.req.header('Accept-Language'))
  context.set(HonoContextKey.LOCALE, locale)
  await next()
}

export function getLocale(context: Context<{ Variables: AppVariables }>): Locale {
  return context.get(HonoContextKey.LOCALE)
}

function parseAcceptLanguage(header: string | undefined): Locale {
  if (!header) return DEFAULT_LOCALE

  const candidates = header
    .split(',')
    .map(parseLanguageEntry)
    .sort((a, b) => b.quality - a.quality)

  for (const candidate of candidates) {
    const match = findLocaleMatch(candidate.tag)
    if (match) return match
  }

  return DEFAULT_LOCALE
}

interface LanguageEntry {
  tag: string
  quality: number
}

function parseLanguageEntry(entry: string): LanguageEntry {
  const [rawTag, qualityPart] = entry.trim().split(';')
  const tag = rawTag?.trim() ?? ''
  const quality = parseQuality(qualityPart)
  return { tag, quality }
}

function parseQuality(qualityPart: string | undefined): number {
  if (!qualityPart) return 1
  const match = /^q=([\d.]+)$/.exec(qualityPart.trim())
  const parsed = match?.[1] ? parseFloat(match[1]) : NaN
  return isNaN(parsed) ? 1 : parsed
}

function findLocaleMatch(tag: string): Locale | null {
  const language = tag.split('-')[0]?.toLowerCase()
  if (!language) return null
  const found = LOCALES.find((locale) => locale === language)
  return found ?? null
}
