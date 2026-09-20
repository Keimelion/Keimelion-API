import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import {
  shopSlugSchema,
  shopNameSchema,
  shopDomainSchema,
  logoUrlSchema,
  isAffiliatedSchema,
  sortOrderSchema,
} from '../../../../db/entities/shops/shops.schemas.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createShop } from '../admin-shops.service.js'

const adminCreateShopSchema = z
  .object({
    slug: shopSlugSchema,
    name: shopNameSchema,
    domain: shopDomainSchema.optional().transform((value) => value ?? null),
    logoUrl: logoUrlSchema.optional().transform((value) => value ?? null),
    isAffiliated: isAffiliatedSchema,
    sortOrder: sortOrderSchema.default(0),
    isActive: z.boolean().default(true),
  })
  .strict()

export type AdminCreateShopInput = z.infer<typeof adminCreateShopSchema>

export function mountCreateShop(router: FeatureRouter): void {
  router.post(
    '/',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('json', adminCreateShopSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createShop(admin.id, input))
    },
  )
}
