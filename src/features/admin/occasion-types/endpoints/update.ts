import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { LOCALES, DEFAULT_LOCALE } from '../../../../shared/enums/locale.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateOccasionTypeById } from '../admin-occasion-types.service.js'

const MIN_SORT_ORDER = 0
const MAX_SORT_ORDER = 32767
const MIN_LABEL_LENGTH = 1
const MAX_LABEL_LENGTH = 100

const adminUpdateOccasionTypeSchema = z
  .object({
    emoji: z.string().trim().min(1).max(10).nullable().optional(),
    sortOrder: z.number().int().min(MIN_SORT_ORDER).max(MAX_SORT_ORDER).optional(),
    isActive: z.boolean().optional(),
    translations: z
      .array(
        z.object({
          locale: z.enum(LOCALES),
          label: z.string().trim().min(MIN_LABEL_LENGTH).max(MAX_LABEL_LENGTH).nullable(),
        }),
      )
      .refine(
        (arr) => new Set(arr.map((translation) => translation.locale)).size === arr.length,
        'Duplicate locale in translations',
      )
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
