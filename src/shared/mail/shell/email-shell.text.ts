import { EMAIL_SHELL_COPY } from './email-shell.copy.js'
import type { EmailInfoBox, EmailShellContent } from './email-shell.js'

const PARAGRAPH_SEPARATOR = '\n\n'
const FOOTER_SEPARATOR = '—'

export function renderEmailText(content: EmailShellContent): string {
  const copy = EMAIL_SHELL_COPY[content.locale]
  const blocks = [
    `${capitalize(content.kicker)}\n${content.title}`,
    ...content.paragraphs,
    `${content.action.label}${copy.labelSeparator}\n${content.action.url}`,
    ...renderInfoBoxBlocks(content.infoBox),
    ...(content.closingNote === null ? [] : [content.closingNote]),
    `${copy.signoff}\n${copy.signature}`,
    renderFooterBlock(content),
  ]
  return `${blocks.join(PARAGRAPH_SEPARATOR)}\n`
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function renderInfoBoxBlocks(infoBox: EmailInfoBox | null): string[] {
  if (infoBox === null) return []
  return [infoBox.highlight, infoBox.text]
}

function renderFooterBlock(content: EmailShellContent): string {
  const copy = EMAIL_SHELL_COPY[content.locale]
  const links = content.footerLinks.map((link) => `${link.label}${copy.labelSeparator} ${link.url}`)
  return [FOOTER_SEPARATOR, copy.publisher, copy.contact, ...links].join('\n')
}
