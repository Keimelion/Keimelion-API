import { env } from '../../../config/env.js'
import type { EmailBannerTheme } from './email-shell.theme.js'

// Email images are versioned PNGs (assets/mail/, rendered by scripts/mail/render-mail-assets.mjs)
// served by the API itself, so they stay separate from the user uploads volume.
export const MAIL_ASSETS_ROUTE = '/assets/mail'
export const MAIL_ASSETS_DIR = './assets/mail'

const MARK_FILE = 'mark.png'

// Relative resolution keeps a path prefix of APP_URL (the API behind a sub-path)
function mailAssetUrl(fileName: string): string {
  const base = env.APP_URL.endsWith('/') ? env.APP_URL : `${env.APP_URL}/`
  return new URL(`${MAIL_ASSETS_ROUTE.slice(1)}/${fileName}`, base).href
}

export function markImageUrl(): string {
  return mailAssetUrl(MARK_FILE)
}

export function bannerImageUrl(theme: EmailBannerTheme): string {
  return mailAssetUrl(`banner-${theme}.png`)
}
