import { LOCALES } from '@keimelion/sdk/enums'
import type { Locale } from '@keimelion/sdk/enums'

interface LanguageEntry {
  tag: string
  quality: number
}

export function parseLocale(value: string): Locale | null {
  return LOCALES.find((locale) => locale === value) ?? null
}

export function matchAcceptLanguage(header: string | undefined): Locale | null {
  if (!header) return null

  const candidates = header
    .split(',')
    .map(parseLanguageEntry)
    .sort((a, b) => b.quality - a.quality)

  for (const candidate of candidates) {
    const match = findLocaleMatch(candidate.tag)
    if (match) return match
  }

  return null
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
  return parseLocale(language)
}
