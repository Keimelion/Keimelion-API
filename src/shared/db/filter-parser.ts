import qs from 'qs'

export interface FilterInput {
  field: string
  operator: string
  value: string | string[]
}

export function parseFilterQuery(rawUrl: string): FilterInput[] {
  const queryString = extractQueryString(rawUrl)
  const parsed = qs.parse(queryString, { allowDots: false, depth: 2 })
  return collectFilterInputs(parsed)
}

function extractQueryString(rawUrl: string): string {
  const questionMarkIndex = rawUrl.indexOf('?')
  if (questionMarkIndex === -1) return ''
  return rawUrl.slice(questionMarkIndex + 1)
}

function collectFilterInputs(parsed: qs.ParsedQs): FilterInput[] {
  const inputs: FilterInput[] = []

  for (const field of Object.keys(parsed)) {
    const fieldValue = parsed[field]
    if (!isPlainObject(fieldValue)) continue
    for (const operator of Object.keys(fieldValue)) {
      const rawValue = (fieldValue as Record<string, unknown>)[operator]
      const value = extractStringValue(rawValue)
      if (value === null) continue
      inputs.push({ field, operator, value })
    }
  }

  return inputs
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractStringValue(raw: unknown): string | string[] | null {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && raw.every((item) => typeof item === 'string')) {
    return raw
  }
  return null
}
