import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { DEFAULT_LOCALE } from '../../../../shared/enums/locale.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createOccasionType } from '../admin-occasion-types.service.js'
import {
  slugSchema,
  emojiSchema,
  labelSchema,
  sortOrderSchema,
  localeSchema,
  hasUniqueLocales,
} from '../../../../db/entities/occasion-types/occasion-types.schemas.js'

const adminCreateOccasionTypeSchema = z
  .object({
    slug: slugSchema,
    emoji: emojiSchema.nullish().transform((value) => value ?? null),
    sortOrder: sortOrderSchema.default(0),
    isActive: z.boolean().default(true),
    translations: z
      .array(z.object({ locale: localeSchema, label: labelSchema }))
      .min(1)
      .refine(hasUniqueLocales, 'Duplicate locale in translations')
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
