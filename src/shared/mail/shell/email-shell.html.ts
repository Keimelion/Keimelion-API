import { bannerImageUrl, markImageUrl } from './email-shell.assets.js'
import { EMAIL_SHELL_COPY } from './email-shell.copy.js'
import type { EmailShellCopy } from './email-shell.copy.js'
import type { EmailInfoBox, EmailLink, EmailShellContent } from './email-shell.js'
import {
  EMAIL_BANNER_COLORS,
  EmailColors,
  EmailDarkColors,
  EmailFonts,
} from './email-shell.theme.js'

const CONTENT_WIDTH_PX = 600
const BANNER_HEIGHT_PX = 136
const LOGO_MARK_SIZE_PX = 30
const SMALL_MARK_SIZE_PX = 22
const MODULE_GAP_PX = 18
const KICKER_GAP_PX = 12
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

// Layout rules (KEI-164 v2): tables, one column, inline styles; no flexbox, transform or SVG.
// The <style> block only carries progressive enhancements (mobile sizes, dark mode).
// Images are hosted PNGs with an empty alt: decorative, the email reads the same with images off
// (the banner cell keeps its theme colour as a fallback).
const HEAD_STYLES = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
table { border-collapse: collapse; }
@media (max-width: 480px) {
  .k-outer { padding: 24px 12px !important; }
  .k-content { padding: 32px 24px !important; }
  .k-banner, .k-banner img { height: 82px !important; }
  .k-title { font-size: 28px !important; }
}
@media (prefers-color-scheme: dark) {
  .k-bg { background: ${EmailDarkColors.BACKGROUND} !important; }
  .k-card { background: ${EmailDarkColors.CARD} !important; }
  .k-info { background: ${EmailDarkColors.BACKGROUND} !important; }
  .k-text { color: ${EmailDarkColors.INK} !important; }
  .k-muted { color: ${EmailDarkColors.INK_MUTED} !important; }
  .k-link { color: ${EmailDarkColors.LINK} !important; }
  .k-brand { color: ${EmailDarkColors.BRAND} !important; }
  .k-rule { border-color: ${EmailDarkColors.RULE} !important; }
}`

export function renderEmailHtml(content: EmailShellContent): string {
  const copy = EMAIL_SHELL_COPY[content.locale]
  return `<!doctype html>
<html lang="${content.locale}">
${renderHead(content.subject)}
<body class="k-bg" style="margin: 0; padding: 0; background: ${EmailColors.BACKGROUND}">
${renderPreheader(content.preheader)}
<table role="presentation" class="k-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${EmailColors.BACKGROUND}" style="background: ${EmailColors.BACKGROUND}">
<tr><td class="k-outer" align="center" style="padding: 32px 24px; font-family: ${EmailFonts.SANS}; color: ${EmailColors.INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: ${String(CONTENT_WIDTH_PX)}px">
${renderLogo(copy)}
${renderCard(content, copy)}
${renderFooter(content, copy)}
</table>
</td></tr>
</table>
</body>
</html>
`
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character)
}

function renderHead(subject: string): string {
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<style>${HEAD_STYLES}</style>
</head>`
}

function renderPreheader(preheader: string): string {
  return `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all">${escapeHtml(preheader)}</div>`
}

function renderMark(sizePx: number): string {
  return `<img src="${escapeHtml(markImageUrl())}" width="${String(sizePx)}" height="${String(sizePx)}" alt="" style="display: block; width: ${String(sizePx)}px; height: ${String(sizePx)}px; border: 0; outline: none">`
}

function renderLogo(copy: EmailShellCopy): string {
  return `<tr><td align="center" style="padding: 0 8px 18px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding: 0 8px 0 0">${renderMark(LOGO_MARK_SIZE_PX)}</td>
<td valign="middle"><span class="k-brand" style="display: inline-block; height: 36px; line-height: 36px; font-family: ${EmailFonts.DISPLAY}; font-weight: 800; letter-spacing: -0.05em; font-size: 26px; color: ${EmailColors.BRAND}">${escapeHtml(copy.brandName)}</span></td>
</tr></table>
</td></tr>`
}

function renderCard(content: EmailShellContent, copy: EmailShellCopy): string {
  const banner = EMAIL_BANNER_COLORS[content.bannerTheme]
  return `<tr><td class="k-card" bgcolor="${EmailColors.CARD}" style="background: ${EmailColors.CARD}; border-radius: 22px; overflow: hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td class="k-banner" height="${String(BANNER_HEIGHT_PX)}" bgcolor="${banner}" style="height: ${String(BANNER_HEIGHT_PX)}px; background: ${banner}; border-radius: 22px 22px 0 0; font-size: 0; line-height: 0; overflow: hidden"><img src="${escapeHtml(bannerImageUrl(content.bannerTheme))}" width="${String(CONTENT_WIDTH_PX)}" height="${String(BANNER_HEIGHT_PX)}" alt="" style="display: block; width: 100%; max-width: ${String(CONTENT_WIDTH_PX)}px; height: ${String(BANNER_HEIGHT_PX)}px; border: 0; outline: none; border-radius: 22px 22px 0 0"></td></tr>
<tr><td class="k-content" style="padding: 40px 48px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${renderContentModules(content, copy)}
</table>
</td></tr>
</table>
</td></tr>`
}

function renderContentModules(content: EmailShellContent, copy: EmailShellCopy): string {
  return [
    renderModule(renderKicker(content.kicker), KICKER_GAP_PX),
    renderModule(renderTitle(content.title)),
    ...content.paragraphs.map((paragraph) => renderModule(renderParagraph(paragraph))),
    renderModule(renderButton(content.action)),
    ...(content.infoBox === null ? [] : [renderModule(renderInfoBox(content.infoBox))]),
    renderModule(renderFallbackLink(content.action.url, copy.fallbackLabel)),
    renderModule(renderRibbonDivider()),
    ...(content.closingNote === null ? [] : [renderModule(renderMutedNote(content.closingNote))]),
    renderModule(renderSignature(copy), 0),
  ].join('\n')
}

function renderModule(innerHtml: string, gapPx: number = MODULE_GAP_PX): string {
  return `<tr><td style="padding: 0 0 ${String(gapPx)}px">${innerHtml}</td></tr>`
}

function renderKicker(kicker: string): string {
  return `<span class="k-brand" style="font-family: ${EmailFonts.HANDWRITTEN}; font-size: 28px; line-height: 28px; color: ${EmailColors.BRAND}">${escapeHtml(kicker)}</span>`
}

function renderTitle(title: string): string {
  return `<h1 class="k-title k-text" style="margin: 0; font-family: ${EmailFonts.DISPLAY}; font-weight: 800; font-size: 34px; line-height: 1.1; letter-spacing: -0.03em; color: ${EmailColors.INK}">${escapeHtml(title)}</h1>`
}

function renderParagraph(paragraph: string): string {
  return `<p class="k-text" style="margin: 0; font-size: 16px; line-height: 25px; color: ${EmailColors.INK}">${escapeHtml(paragraph)}</p>`
}

// Bulletproof button: the relief comes from border-bottom because Gmail strips box-shadow.
// 14px + 20px + 14px + 4px border = 52px touch target. Outlook for Windows renders square corners.
function renderButton(action: EmailLink): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 6px 0 2px"><tr>
<td bgcolor="${EmailColors.BRAND}" style="border-radius: 999px; background: ${EmailColors.BRAND}; border-bottom: 4px solid ${EmailColors.BRAND_DEEP}">
<a href="${escapeHtml(action.url)}" target="_blank" style="display: inline-block; padding: 14px 30px; font-family: ${EmailFonts.SANS}; font-weight: 700; font-size: 16px; line-height: 20px; color: ${EmailColors.ON_BRAND}; text-decoration: none; border-radius: 999px">${escapeHtml(action.label)}</a>
</td></tr></table>`
}

function renderInfoBox(infoBox: EmailInfoBox): string {
  return `<table role="presentation" class="k-info" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${EmailColors.BACKGROUND}" style="background: ${EmailColors.BACKGROUND}; border-radius: 14px"><tr>
<td valign="top" style="padding: 14px 12px 14px 16px; width: 22px">
<div style="width: 22px; height: 22px; line-height: 22px; border-radius: 999px; background: ${EmailColors.INFO_BADGE}; color: ${EmailColors.INK}; text-align: center; font-weight: 700; font-size: 13px">i</div>
</td>
<td class="k-text" valign="top" style="padding: 14px 16px 14px 0; font-size: 14px; line-height: 20px; color: ${EmailColors.INK}"><strong>${escapeHtml(infoBox.highlight)}</strong> ${escapeHtml(infoBox.text)}</td>
</tr></table>`
}

function renderFallbackLink(url: string, label: string): string {
  return `<p class="k-muted" style="margin: 0; font-size: 14px; line-height: 20px; color: ${EmailColors.INK_MUTED}">${escapeHtml(label)}<br>
<a class="k-link" href="${escapeHtml(url)}" target="_blank" style="color: ${EmailColors.LINK}; text-decoration: underline; word-break: break-all; font-family: ${EmailFonts.MONO}; font-size: 12px">${escapeHtml(url)}</a></p>`
}

function renderRibbonDivider(): string {
  const dashedRule = `<td class="k-rule" width="50%" style="border-top: 2px dashed ${EmailColors.RULE}; font-size: 0; line-height: 0">&nbsp;</td>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${dashedRule}
<td style="padding: 0 10px; font-size: 0; line-height: 0">${renderMark(SMALL_MARK_SIZE_PX)}</td>
${dashedRule}
</tr></table>`
}

function renderMutedNote(note: string): string {
  return `<p class="k-muted" style="margin: 0; font-size: 14px; line-height: 20px; color: ${EmailColors.INK_MUTED}">${escapeHtml(note)}</p>`
}

function renderSignature(copy: EmailShellCopy): string {
  return `<p class="k-text" style="margin: 0; font-size: 16px; line-height: 24px; color: ${EmailColors.INK}">${escapeHtml(copy.signoff)}<br>
<span class="k-brand" style="font-family: ${EmailFonts.HANDWRITTEN}; font-size: 26px; line-height: 30px; color: ${EmailColors.BRAND}">${escapeHtml(copy.signature)}</span></p>`
}

function renderFooter(content: EmailShellContent, copy: EmailShellCopy): string {
  const lines = [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td valign="middle" style="padding: 0 6px 0 0">${renderMark(SMALL_MARK_SIZE_PX)}</td>
<td valign="middle"><span class="k-brand" style="font-family: ${EmailFonts.HANDWRITTEN}; font-size: 20px; line-height: 24px; font-style: italic; color: ${EmailColors.BRAND}">${escapeHtml(copy.tagline)}</span></td>
</tr></table>`,
    escapeHtml(copy.publisher),
    escapeHtml(copy.contact),
    content.footerLinks.map((link) => renderFooterLink(link)).join(' · '),
  ]
  const rows = lines.map(
    (line) => `<tr><td align="center" style="padding: 0 0 8px">${line}</td></tr>`,
  )
  return `<tr><td class="k-muted" align="center" style="padding: 28px 32px 8px; text-align: center; font-size: 12px; line-height: 18px; color: ${EmailColors.INK_MUTED}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows.join('\n')}
</table>
</td></tr>`
}

function renderFooterLink(link: EmailLink): string {
  return `<a class="k-link" href="${escapeHtml(link.url)}" target="_blank" style="color: ${EmailColors.LINK}; text-decoration: underline">${escapeHtml(link.label)}</a>`
}
