import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import {
  shopSlugSchema,
  shopNameSchema,
  shopDomainSchema,
  logoUrlSchema,
  sortOrderSchema,
} from '../../../../db/entities/shops/shops.schemas.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateShopById } from '../admin-shops.service.js'

const adminUpdateShopSchema = z
  .object({
    slug: shopSlugSchema.optional(),
    name: shopNameSchema.optional(),
    domain: shopDomainSchema.optional(),
    logoUrl: logoUrlSchema.optional(),
    isAffiliated: z.boolean().optional(),
    sortOrder: sortOrderSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

export function mountUpdateShop(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', adminUpdateShopSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateShopById(admin.id, id, input))
    },
  )
}
