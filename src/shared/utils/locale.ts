import { LOCALES } from '@keimelion/sdk/enums'
import type { Locale } from '@keimelion/sdk/enums'

export function parseLocale(value: string): Locale | null {
  return LOCALES.find((locale) => locale === value) ?? null
}
