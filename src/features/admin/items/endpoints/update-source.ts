import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateItemSourceById } from '../admin-items.service.js'

const MAX_SOURCE_URL_LENGTH = 2048
const PRICE_REGEX = /^\d{1,8}(\.\d{1,2})?$/
const CURRENCY_REGEX = /^[A-Z]{3}$/
const CURRENCY_LENGTH = 3

const httpsSourceUrlSchema = z
  .string()
  .url()
  .max(MAX_SOURCE_URL_LENGTH)
  .refine((value) => value.startsWith('https://'), 'source_url must use HTTPS')
  .nullable()

const itemSourceParamSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
})

const adminUpdateItemSourceSchema = z
  .object({
    shopId: z.string().uuid().nullable().optional(),
    sourceUrl: httpsSourceUrlSchema.optional(),
    price: z.string().regex(PRICE_REGEX).nullable().optional(),
    currency: z.string().length(CURRENCY_LENGTH).regex(CURRENCY_REGEX).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict()

export type UpdateItemSourceInput = z.infer<typeof adminUpdateItemSourceSchema>

export function mountUpdateItemSource(router: FeatureRouter): void {
  router.patch(
    '/:id/sources/:sourceId',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('param', itemSourceParamSchema, validationErrorHandler),
    zValidator('json', adminUpdateItemSourceSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id, sourceId } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateItemSourceById(admin.id, id, sourceId, input))
    },
  )
}
