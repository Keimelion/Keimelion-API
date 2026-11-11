import type { Locale } from '@keimelion/sdk/enums'
import { renderEmailHtml } from './email-shell.html.js'
import { renderEmailText } from './email-shell.text.js'
import type { EmailBannerTheme } from './email-shell.theme.js'

export interface EmailLink {
  label: string
  url: string
}

export interface EmailInfoBox {
  highlight: string
  text: string
}

// One email = the KEI-164 v2 modules in a fixed order: logo, banner, kicker, title, body, button,
// info box, fallback link, ribbon divider, closing note, signature, footer.
export interface EmailShellContent {
  locale: Locale
  subject: string
  preheader: string
  bannerTheme: EmailBannerTheme
  kicker: string
  title: string
  paragraphs: string[]
  action: EmailLink
  infoBox: EmailInfoBox | null
  closingNote: string | null
  footerLinks: EmailLink[]
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export function renderEmail(content: EmailShellContent): RenderedEmail {
  return {
    subject: content.subject,
    html: renderEmailHtml(content),
    text: renderEmailText(content),
  }
}
