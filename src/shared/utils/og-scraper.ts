const OG_FETCH_TIMEOUT_MS = 5000

interface OgData {
  title: string | null
  image: string | null
  price: string | null
}

export async function scrapeOgData(url: string): Promise<OgData> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => { controller.abort() }, OG_FETCH_TIMEOUT_MS)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Keimelion/1.0 (+https://keimelion.fr)' },
    })

    clearTimeout(timeoutId)

    const html = await response.text()
    return parseOgTags(html)
  } catch {
    return { title: null, image: null, price: null }
  }
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
  return (match[1] ?? match[2] ?? null)
}
