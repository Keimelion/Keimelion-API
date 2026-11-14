const MIN_DOMAIN_LABEL_COUNT = 2
const TRAILING_DOT_REGEX = /\.$/

export function extractDomainCandidates(url: string): string[] {
  const hostname = parseHostname(url)
  if (hostname === null) return []

  const labels = hostname.split('.')
  const candidateCount = Math.max(labels.length - MIN_DOMAIN_LABEL_COUNT + 1, 0)
  return Array.from({ length: candidateCount }, (_, start) => labels.slice(start).join('.'))
}

function parseHostname(url: string): string | null {
  if (!URL.canParse(url)) return null
  return new URL(url).hostname.toLowerCase().replace(TRAILING_DOT_REGEX, '')
}
