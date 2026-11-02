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

export function buildSlugFromName(name: string): string {
  return slugify(name, { lower: true, strict: true, trim: true })
}

export function normalizeTagSlugs(names: string[]): string[] | null {
  const slugs: string[] = []
  for (const name of names) {
    const slug = buildSlugFromName(name)
    if (slug.length === 0) return null
    slugs.push(slug)
  }
  return Array.from(new Set(slugs))
}

function randomSuffix(): string {
  const alphabetLength = SLUG_SUFFIX_ALPHABET.length
  let out = ''
  for (let i = 0; i < SLUG_SUFFIX_LENGTH; i += 1) {
    out += SLUG_SUFFIX_ALPHABET[randomInt(0, alphabetLength)] ?? ''
  }
  return out
}
