const TRACKING_PARAM_DENYLIST = /^(?:utm_.+|gclid|fbclid)$/i
const QUERY_SEPARATOR = '&'
const KEY_VALUE_SEPARATOR = '='

export function normalizeUrlWithDefaults(url: URL): URL {
  const normalized = removeQueryParams(url, TRACKING_PARAM_DENYLIST)
  normalized.hash = ''
  return normalized
}

// Filters the raw query segments rather than going through URLSearchParams, which would re-encode the
// parameters that are kept (e.g. "," into "%2C") and alter product variant URLs.
export function removeQueryParams(url: URL, denylist: RegExp): URL {
  const result = new URL(url.href)
  const keptSegments = result.search
    .slice(1)
    .split(QUERY_SEPARATOR)
    .filter((segment) => segment.length > 0 && !denylist.test(extractQueryKey(segment)))
  result.search = keptSegments.join(QUERY_SEPARATOR)
  return result
}

function extractQueryKey(segment: string): string {
  const [key = ''] = segment.split(KEY_VALUE_SEPARATOR, 1)
  return key
}
