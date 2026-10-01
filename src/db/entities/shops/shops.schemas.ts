import { z } from 'zod'
import { ASCII_HOSTNAME_REGEX, normalizeDomain } from '../../../shared/utils/domain.js'
import { httpsUrlSchema } from '../../../shared/schemas/url.js'

export { sortOrderSchema } from '../../../shared/schemas/sort-order.js'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MIN_SLUG_LENGTH = 2
const MAX_SLUG_LENGTH = 60

const MIN_NAME_LENGTH = 1
const MAX_NAME_LENGTH = 120

const MAX_DOMAIN_LENGTH = 253
const MAX_LOGO_URL_LENGTH = 2048

export const shopSlugSchema = z
  .string()
  .trim()
  .min(MIN_SLUG_LENGTH)
  .max(MAX_SLUG_LENGTH)
  .regex(SLUG_REGEX, 'slug must be lowercase letters, digits, and dashes (e.g. my-shop)')

export const shopNameSchema = z.string().trim().min(MIN_NAME_LENGTH).max(MAX_NAME_LENGTH)

export const shopDomainSchema = z
  .string()
  .trim()
  .transform(normalizeDomain)
  .pipe(
    z
      .string()
      .max(MAX_DOMAIN_LENGTH)
      .regex(
        ASCII_HOSTNAME_REGEX,
        'domain must be a valid hostname (lowercase letters, digits, dots, and dashes)',
      ),
  )
  .nullable()

export const logoUrlSchema = httpsUrlSchema('logoUrl', MAX_LOGO_URL_LENGTH).nullable()

export const isAffiliatedSchema = z.boolean().default(false)
