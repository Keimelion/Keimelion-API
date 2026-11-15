import { EMAIL_SHELL_COPY } from './email-shell.copy.js'
import type { EmailShellCopy } from './email-shell.copy.js'
import type { EmailInfoBox, EmailParagraph, EmailShellContent } from './email-shell.js'

const PARAGRAPH_SEPARATOR = '\n\n'
const FOOTER_SEPARATOR = '—'

export function renderEmailText(content: EmailShellContent): string {
  const copy = EMAIL_SHELL_COPY[content.locale]
  const blocks = [
    `${capitalize(content.kicker)}\n${content.title}`,
    ...content.paragraphs.map(renderParagraphText),
    `${content.action.label}${copy.labelSeparator}\n${content.action.url}`,
    ...renderInfoBoxBlocks(content.infoBox),
    ...(content.closingNote === null ? [] : [content.closingNote]),
    `${copy.signoff}\n${copy.signature}`,
    renderFooterBlock(content, copy),
  ]
  return `${blocks.join(PARAGRAPH_SEPARATOR)}\n`
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function renderParagraphText(paragraph: EmailParagraph): string {
  return [paragraph]
    .flat()
    .map((run) => (typeof run === 'string' ? run : run.strong))
    .join('')
}

// One block, as in the HTML box: the highlight can be the start of the sentence the text ends
function renderInfoBoxBlocks(infoBox: EmailInfoBox | null): string[] {
  if (infoBox === null) return []
  return [`${infoBox.highlight} ${infoBox.text}`]
}

function renderFooterBlock(content: EmailShellContent, copy: EmailShellCopy): string {
  const links = content.footerLinks.map((link) => `${link.label}${copy.labelSeparator} ${link.url}`)
  const reason = content.footerReason === null ? [] : [content.footerReason]
  return [FOOTER_SEPARATOR, ...reason, copy.publisher, copy.contact, ...links].join('\n')
}
