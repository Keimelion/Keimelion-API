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

export interface EmailStrongText {
  strong: string
}

export type EmailTextRun = string | EmailStrongText

// Plain text, or runs of text where some words are set in bold
export type EmailParagraph = string | EmailTextRun[]

// One email = the KEI-164 v2 modules in a fixed order: logo, banner, kicker, title, body, button,
// info box, fallback link, ribbon divider, closing note, signature, footer. The footer opens with
// the reason the recipient gets the email, when there is one.
export interface EmailShellContent {
  locale: Locale
  subject: string
  preheader: string
  bannerTheme: EmailBannerTheme
  kicker: string
  title: string
  paragraphs: EmailParagraph[]
  action: EmailLink
  infoBox: EmailInfoBox | null
  closingNote: string | null
  footerReason: string | null
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
