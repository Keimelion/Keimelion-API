import type { Locale } from '@keimelion/sdk/enums'
import { env } from '../../config/env.js'
import type { EmailLink } from './shell/email-shell.js'

const TOKEN_PARAMETER = 'token'

// Pages of the public web app that handle the links of the account emails. The token is read from
// the URL fragment: #token=<token>
export const WebAppPaths = {
  VERIFY_EMAIL: '/auth/verify-email',
  RESET_PASSWORD: '/auth/reset-password',
  ACCEPT_LIST_INVITE: '/invites/accept',
} as const

type WebAppPath = (typeof WebAppPaths)[keyof typeof WebAppPaths]

const BACKOFFICE_RESET_PASSWORD_PATH = '/reset-password'

interface LocalizedPath {
  label: string
  path: string
}

const PRIVACY_POLICY_LINKS: Record<Locale, LocalizedPath> = {
  fr: { label: 'Politique de confidentialité', path: '/politique-de-confidentialite' },
  en: { label: 'Privacy policy', path: '/en/privacy-policy' },
}

export function privacyPolicyLink(locale: Locale): EmailLink {
  const link = PRIVACY_POLICY_LINKS[locale]
  return { label: link.label, url: new URL(link.path, env.LANDING_URL).href }
}

// Tokens travel in the URL fragment: browsers never send it to the server, so it stays out of
// the reverse-proxy access logs.
export function buildFragmentTokenUrl(baseUrl: string, path: string, token: string): string {
  const url = new URL(path, baseUrl)
  url.hash = new URLSearchParams({ [TOKEN_PARAMETER]: token }).toString()
  return url.href
}

export function buildWebAppTokenUrl(path: WebAppPath, token: string): string {
  return buildFragmentTokenUrl(env.WEB_APP_URL, path, token)
}

// The Backoffice reset-password page only reads the token from the query string, so the token
// reaches its access log: it is stored hashed, single-use (cleared on reset) and short-lived.
export function buildBackofficeSetPasswordUrl(token: string): string {
  const url = new URL(BACKOFFICE_RESET_PASSWORD_PATH, env.BACKOFFICE_URL)
  url.search = new URLSearchParams({ [TOKEN_PARAMETER]: token }).toString()
  return url.href
}
