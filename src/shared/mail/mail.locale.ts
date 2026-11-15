import type { Locale } from '@keimelion/sdk/enums'
import { matchAcceptLanguage } from '../utils/locale.js'

// Account emails go out in French when the recipient's language is unknown
export const EMAIL_DEFAULT_LOCALE: Locale = 'fr'

export function resolveEmailLocale(acceptLanguage: string | undefined): Locale {
  return matchAcceptLanguage(acceptLanguage) ?? EMAIL_DEFAULT_LOCALE
}
