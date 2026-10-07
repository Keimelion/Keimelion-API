import { randomBytes } from 'node:crypto'
import slugify from 'slugify'

const SLUG_SUFFIX_LENGTH = 6
const SLUG_SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const SLUG_MAX_BASE_LENGTH = 60

export function buildSlugFromTitle(title: string): string {
  const base = slugify(title, { lower: true, strict: true, trim: true }).slice(0, SLUG_MAX_BASE_LENGTH)
  const fallback = base.length > 0 ? base : 'list'
  return `${fallback}-${randomSuffix()}`
}

function randomSuffix(): string {
  const alphabetLength = SLUG_SUFFIX_ALPHABET.length
  const bytes = randomBytes(SLUG_SUFFIX_LENGTH)
  return Array.from(bytes, (byte) => SLUG_SUFFIX_ALPHABET[byte % alphabetLength] ?? '').join('')
}
