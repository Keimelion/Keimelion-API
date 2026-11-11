// Renders the email images (KEI-164 v2 design) from SVG to PNG into assets/mail/.
// Email clients do not render SVG, so the committed PNGs are what the emails reference.
// Run after a design change: node scripts/mail/render-mail-assets.mjs
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const OUTPUT_DIR = fileURLToPath(new URL('../../assets/mail/', import.meta.url))
// Retina: images are rendered at 3x their display size, the HTML sets the display size
const SCALE = 3
const BRAND = '#B3204C'
const CREAM = '#FFFAF0'
const BANNER_WIDTH = 600
const BANNER_HEIGHT = 136
const MARK_SIZE = 30

// Ribbon-bow mark of the logo, drawn in a 100 x 100 box
const MARK_PATHS = `<g transform="translate(0 -2)">
<path fill="${BRAND}" d="M46 50C40 62 32 74 22 86l8-1 3 8c8-12 14-26 17-40zM54 50c6 12 14 24 24 36l-8-1-3 8c-8-12-14-26-17-40z"/>
<path d="M50 44C42 26 14 24 14 42c0 16 24 18 36 2 12-16 36-18 36-2 0 18-28 16-36 0z" fill="none" stroke="${BRAND}" stroke-width="11" stroke-linejoin="round"/>
<circle cx="50" cy="46" r="7" fill="${BRAND}"/>
</g>`

// Banner themes: background from the design, dots = background mixed with 30 % white,
// gift box mustard (rose on the mustard launch banner so the box stays visible)
const BANNERS = {
  waitlist: { background: '#CDB8F5', box: '#F2BF3D' },
  reservation: { background: '#A8E0C0', box: '#F2BF3D' },
  account: { background: '#9FCBF2', box: '#F2BF3D' },
  launch: { background: '#F2BF3D', box: '#F7B8C8' },
}

function mixWithWhite(hex, ratio) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16))
  const mixed = channels.map((channel) => Math.round(channel + (255 - channel) * ratio))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function markSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${MARK_SIZE * SCALE}" height="${MARK_SIZE * SCALE}">${MARK_PATHS}</svg>`
}

function bannerSvg({ background, box }) {
  const dots = mixWithWhite(background, 0.3)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 22 ${BANNER_WIDTH} ${BANNER_HEIGHT}" width="${BANNER_WIDTH * SCALE}" height="${BANNER_HEIGHT * SCALE}" preserveAspectRatio="xMidYMid slice">
<defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
<rect width="24" height="24" fill="${background}"/>
<circle cx="6" cy="6" r="3" fill="${dots}"/><circle cx="18" cy="18" r="3" fill="${dots}"/>
</pattern></defs>
<rect y="0" width="${BANNER_WIDTH}" height="180" fill="url(#dots)"/>
<g transform="rotate(-3 300 90)">
<rect x="260" y="58" width="80" height="64" rx="9.6" fill="${box}"/>
<rect x="294.8" y="58" width="10.4" height="64" fill="${CREAM}" opacity="0.92"/>
<rect x="260" y="84.8" width="80" height="10.4" fill="${CREAM}" opacity="0.92"/>
<g transform="translate(300 86.8) scale(0.4444) translate(-50 -46)">${MARK_PATHS}</g>
</g>
</svg>`
}

async function renderPng(svg, fileName) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(`${OUTPUT_DIR}${fileName}`)
  console.log(`assets/mail/${fileName}`)
}

await mkdir(OUTPUT_DIR, { recursive: true })
await renderPng(markSvg(), 'mark.png')
for (const [theme, colors] of Object.entries(BANNERS)) {
  await renderPng(bannerSvg(colors), `banner-${theme}.png`)
}
