import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import {
  currencySchema,
  httpsSourceUrlSchema,
  itemSourceParamSchema,
  priceSchema,
  shopIdSchema,
} from '../../../../db/entities/item-sources/item-sources.schemas.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateItemSourceById } from '../admin-item-sources.service.js'

const adminUpdateItemSourceSchema = z
  .object({
    shopId: shopIdSchema.optional(),
    sourceUrl: httpsSourceUrlSchema.optional(),
    price: priceSchema.optional(),
    currency: currencySchema.optional(),
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
