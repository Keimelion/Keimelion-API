import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { DEFAULT_LOCALE } from '../../../../shared/enums/locale.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateOccasionTypeById } from '../admin-occasion-types.service.js'
import {
  emojiSchema,
  labelSchema,
  sortOrderSchema,
  localeSchema,
  hasUniqueLocales,
} from '../../../../db/entities/occasion-types/occasion-types.schemas.js'

const adminUpdateOccasionTypeSchema = z
  .object({
    emoji: emojiSchema.nullable().optional(),
    sortOrder: sortOrderSchema.optional(),
    isActive: z.boolean().optional(),
    translations: z
      .array(z.object({ locale: localeSchema, label: labelSchema.nullable() }))
      .refine(hasUniqueLocales, 'Duplicate locale in translations')
      .refine(
        (arr) =>
          !arr.some(
            (translation) => translation.locale === DEFAULT_LOCALE && translation.label === null,
          ),
        `Cannot remove the default locale (${DEFAULT_LOCALE}) translation`,
      )
      .optional(),
  })
  .strict()

export type AdminUpdateOccasionTypeInput = z.infer<typeof adminUpdateOccasionTypeSchema>

export function mountUpdateOccasionType(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', adminUpdateOccasionTypeSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateOccasionTypeById(admin.id, id, input))
    },
  )
}
