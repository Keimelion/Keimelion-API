import { randomInt } from 'node:crypto'
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
  let out = ''
  for (let i = 0; i < SLUG_SUFFIX_LENGTH; i += 1) {
    out += SLUG_SUFFIX_ALPHABET[randomInt(0, alphabetLength)] ?? ''
  }
  return out
}
