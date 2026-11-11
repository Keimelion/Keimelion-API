// Renders the email images (KEI-164 v2 design) from SVG to PNG into assets/mail/.
// Email clients do not render SVG, so the committed PNGs are what the emails reference.
// Run after a design change: npm run mail:assets
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  EMAIL_BANNER_COLORS,
  EMAIL_BANNER_HEIGHT_PX,
  EMAIL_CONTENT_WIDTH_PX,
  EMAIL_LOGO_MARK_SIZE_PX,
  EMAIL_MARK_FILE,
  EmailBannerThemes,
  EmailColors,
  emailBannerFile,
} from '../../shared/mail/shell/email-shell.theme.js'
import type { EmailBannerTheme } from '../../shared/mail/shell/email-shell.theme.js'

const OUTPUT_DIR = fileURLToPath(new URL('../../../assets/mail/', import.meta.url))
// Retina: images are rendered at 3x their display size, the HTML sets the display size
const SCALE = 3
const DOTS_WHITE_RATIO = 0.3
const GIFT_BOX_MUSTARD = '#F2BF3D'
const GIFT_BOX_ROSE = '#F7B8C8'

// Gift box mustard, rose on the mustard launch banner so the box stays visible
const GIFT_BOX_COLORS: Record<EmailBannerTheme, string> = {
  [EmailBannerThemes.WAITLIST]: GIFT_BOX_MUSTARD,
  [EmailBannerThemes.RESERVATION]: GIFT_BOX_MUSTARD,
  [EmailBannerThemes.ACCOUNT]: GIFT_BOX_MUSTARD,
  [EmailBannerThemes.LAUNCH]: GIFT_BOX_ROSE,
}

// Ribbon-bow mark of the logo, drawn in a 100 x 100 box
const MARK_PATHS = `<g transform="translate(0 -2)">
<path fill="${EmailColors.BRAND}" d="M46 50C40 62 32 74 22 86l8-1 3 8c8-12 14-26 17-40zM54 50c6 12 14 24 24 36l-8-1-3 8c-8-12-14-26-17-40z"/>
<path d="M50 44C42 26 14 24 14 42c0 16 24 18 36 2 12-16 36-18 36-2 0 18-28 16-36 0z" fill="none" stroke="${EmailColors.BRAND}" stroke-width="11" stroke-linejoin="round"/>
<circle cx="50" cy="46" r="7" fill="${EmailColors.BRAND}"/>
</g>`

// Dots = banner background mixed with 30 % white
function mixWithWhite(hex: string, ratio: number): string {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16))
  const mixed = channels.map((channel) => Math.round(channel + (255 - channel) * ratio))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function markSvg(): string {
  const size = String(EMAIL_LOGO_MARK_SIZE_PX * SCALE)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${MARK_PATHS}</svg>`
}

function bannerSvg(theme: EmailBannerTheme): string {
  const background = EMAIL_BANNER_COLORS[theme]
  const dots = mixWithWhite(background, DOTS_WHITE_RATIO)
  const width = String(EMAIL_CONTENT_WIDTH_PX)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 22 ${width} ${String(EMAIL_BANNER_HEIGHT_PX)}" width="${String(EMAIL_CONTENT_WIDTH_PX * SCALE)}" height="${String(EMAIL_BANNER_HEIGHT_PX * SCALE)}" preserveAspectRatio="xMidYMid slice">
<defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
<rect width="24" height="24" fill="${background}"/>
<circle cx="6" cy="6" r="3" fill="${dots}"/><circle cx="18" cy="18" r="3" fill="${dots}"/>
</pattern></defs>
<rect y="0" width="${width}" height="180" fill="url(#dots)"/>
<g transform="rotate(-3 300 90)">
<rect x="260" y="58" width="80" height="64" rx="9.6" fill="${GIFT_BOX_COLORS[theme]}"/>
<rect x="294.8" y="58" width="10.4" height="64" fill="${EmailColors.CARD}" opacity="0.92"/>
<rect x="260" y="84.8" width="80" height="10.4" fill="${EmailColors.CARD}" opacity="0.92"/>
<g transform="translate(300 86.8) scale(0.4444) translate(-50 -46)">${MARK_PATHS}</g>
</g>
</svg>`
}

async function renderPng(svg: string, fileName: string): Promise<void> {
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, palette: true })
    .toFile(`${OUTPUT_DIR}${fileName}`)
  console.log(`assets/mail/${fileName}`)
}

await mkdir(OUTPUT_DIR, { recursive: true })
await renderPng(markSvg(), EMAIL_MARK_FILE)
for (const theme of Object.values(EmailBannerThemes)) {
  await renderPng(bannerSvg(theme), emailBannerFile(theme))
}
