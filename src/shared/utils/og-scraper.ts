import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const OG_FETCH_TIMEOUT_MS = 5000
const MAX_RESPONSE_BYTES = 1_000_000
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

interface OgData {
  title: string | null
  image: string | null
  price: string | null
}

export async function scrapeOgData(url: string): Promise<OgData> {
  const emptyResult: OgData = { title: null, image: null, price: null }

  const parsedUrl = safeParseUrl(url)
  if (!parsedUrl) return emptyResult
  if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) return emptyResult
  if (await isForbiddenHost(parsedUrl.hostname)) return emptyResult

  try {
    const html = await fetchLimitedHtml(parsedUrl)
    if (!html) return emptyResult
    return parseOgTags(html)
  } catch {
    return emptyResult
  }
}

function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

async function isForbiddenHost(hostname: string): Promise<boolean> {
  const literalIpKind = isIP(hostname)
  if (literalIpKind !== 0) return isBlockedIp(hostname)

  try {
    const resolved = await lookup(hostname, { all: true })
    return resolved.some((entry) => isBlockedIp(entry.address))
  } catch {
    return true
  }
}

function isBlockedIp(address: string): boolean {
  if (isIP(address) === 4) return isBlockedIpv4(address)
  return isBlockedIpv6(address)
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true
  const [first = 0, second = 0] = parts
  if (first === 10) return true
  if (first === 127) return true
  if (first === 0) return true
  if (first === 169 && second === 254) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  if (first === 192 && second === 168) return true
  if (first === 100 && second >= 64 && second <= 127) return true
  if (first >= 224) return true
  return false
}

function isBlockedIpv6(address: string): boolean {
  const normalised = address.toLowerCase()
  if (normalised === '::1' || normalised === '::') return true
  if (normalised.startsWith('fc') || normalised.startsWith('fd')) return true
  if (normalised.startsWith('fe80')) return true
  if (normalised.startsWith('::ffff:')) return isBlockedIpv4(normalised.slice('::ffff:'.length))
  return false
}

async function fetchLimitedHtml(parsedUrl: URL): Promise<string | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => { controller.abort() }, OG_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      redirect: 'error',
      headers: { 'User-Agent': 'Keimelion/1.0 (+https://keimelion.fr)' },
    })
    if (!response.ok || !response.body) return null
    return await readCappedText(response.body)
  } finally {
    clearTimeout(timeoutId)
  }
}

async function readCappedText(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let text = ''
  while (received < MAX_RESPONSE_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    text += decoder.decode(value, { stream: true })
    if (received >= MAX_RESPONSE_BYTES) break
  }
  text += decoder.decode()
  try {
    await reader.cancel()
  } catch {
    // noop
  }
  return text
}

function parseOgTags(html: string): OgData {
  return {
    title: extractMetaContent(html, 'og:title'),
    image: extractMetaContent(html, 'og:image'),
    price: extractMetaContent(html, 'og:price:amount') ?? extractMetaContent(html, 'product:price:amount'),
  }
}

function extractMetaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`,
    'i',
  )
  const match = pattern.exec(html)
  if (!match) return null
  return match[1] ?? match[2] ?? null
}
