import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { LOCALES, DEFAULT_LOCALE } from '../../../../shared/enums/locale.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createOccasionType } from '../admin-occasion-types.service.js'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MIN_SLUG_LENGTH = 2
const MAX_SLUG_LENGTH = 60
const MIN_LABEL_LENGTH = 1
const MAX_LABEL_LENGTH = 100
const MIN_EMOJI_LENGTH = 1
const MAX_EMOJI_LENGTH = 10
const MIN_SORT_ORDER = 0
const MAX_SORT_ORDER = 32767

const adminCreateOccasionTypeSchema = z
  .object({
    slug: z.string().trim().regex(SLUG_REGEX).min(MIN_SLUG_LENGTH).max(MAX_SLUG_LENGTH),
    emoji: z
      .string()
      .trim()
      .min(MIN_EMOJI_LENGTH)
      .max(MAX_EMOJI_LENGTH)
      .nullish()
      .transform((value) => value ?? null),
    sortOrder: z.number().int().min(MIN_SORT_ORDER).max(MAX_SORT_ORDER).default(0),
    isActive: z.boolean().default(true),
    translations: z
      .array(
        z.object({
          locale: z.enum(LOCALES),
          label: z.string().trim().min(MIN_LABEL_LENGTH).max(MAX_LABEL_LENGTH),
        }),
      )
      .min(1)
      .refine(
        (arr) => new Set(arr.map((translation) => translation.locale)).size === arr.length,
        'Duplicate locale in translations',
      )
      .refine(
        (arr) => arr.some((translation) => translation.locale === DEFAULT_LOCALE),
        `Translation for default locale (${DEFAULT_LOCALE}) is required`,
      ),
  })
  .strict()

export type AdminCreateOccasionTypeInput = z.infer<typeof adminCreateOccasionTypeSchema>

export function mountCreateOccasionType(router: FeatureRouter): void {
  router.post(
    '/',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('json', adminCreateOccasionTypeSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createOccasionType(admin.id, input))
    },
  )
}
