import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import {
  currencySchema,
  httpsSourceUrlSchema,
  priceSchema,
  shopIdSchema,
} from '../../../../db/entities/item-sources/item-sources.schemas.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createItemSource } from '../admin-items.service.js'

const adminCreateItemSourceSchema = z
  .object({
    shopId: shopIdSchema.optional().transform((value) => value ?? null),
    sourceUrl: httpsSourceUrlSchema.optional().transform((value) => value ?? null),
    price: priceSchema.optional().transform((value) => value ?? null),
    currency: currencySchema.default('EUR'),
    isPrimary: z.boolean().default(false),
  })
  .strict()

export type CreateItemSourceInput = z.infer<typeof adminCreateItemSourceSchema>

export function mountCreateItemSource(router: FeatureRouter): void {
  router.post(
    '/:id/sources',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', adminCreateItemSourceSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await createItemSource(admin.id, id, input))
    },
  )
}
