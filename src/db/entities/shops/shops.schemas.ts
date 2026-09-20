import { z } from 'zod'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MIN_SLUG_LENGTH = 2
const MAX_SLUG_LENGTH = 60

const MIN_NAME_LENGTH = 1
const MAX_NAME_LENGTH = 120

const MAX_DOMAIN_LENGTH = 253
const MAX_LOGO_URL_LENGTH = 2048

const MIN_SORT_ORDER = 0
const MAX_SORT_ORDER = 32767

const ASCII_HOSTNAME_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/

const BLOCKED_DOMAINS = ['localhost', '127.0.0.1']
const RFC1918_REGEX = /^(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/

export const shopSlugSchema = z
  .string()
  .trim()
  .min(MIN_SLUG_LENGTH)
  .max(MAX_SLUG_LENGTH)
  .regex(SLUG_REGEX)

export const shopNameSchema = z.string().trim().min(MIN_NAME_LENGTH).max(MAX_NAME_LENGTH)

export const shopDomainSchema = z
  .string()
  .trim()
  .transform((value) => {
    let normalized = value.toLowerCase()
    const withProtocol = normalized.startsWith('http://') || normalized.startsWith('https://')
      ? normalized
      : `https://${normalized}`
    try {
      const parsed = new URL(withProtocol)
      normalized = parsed.hostname
    } catch {
      normalized = value.toLowerCase()
    }
    normalized = normalized.replace(/\/$/, '')
    normalized = normalized.replace(/^www\./, '')
    return normalized
  })
  .pipe(
    z
      .string()
      .max(MAX_DOMAIN_LENGTH)
      .regex(ASCII_HOSTNAME_REGEX)
      .refine((value) => !BLOCKED_DOMAINS.includes(value), 'Domain not allowed')
      .refine((value) => !RFC1918_REGEX.test(value), 'Private IP ranges are not allowed'),
  )
  .nullable()

export const logoUrlSchema = z
  .string()
  .url()
  .max(MAX_LOGO_URL_LENGTH)
  .refine((value) => value.startsWith('https://'), 'logo_url must use HTTPS')
  .nullable()

export const isAffiliatedSchema = z.boolean().default(false)

export const sortOrderSchema = z.number().int().min(MIN_SORT_ORDER).max(MAX_SORT_ORDER)
