import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { logoUrlSchema } from '../../../../db/entities/shops/shops.schemas.js'
import { MODERATION_STATUS_VALUES } from '../../../../shared/enums/moderation-status.js'
import {
  currencySchema,
  httpsSourceUrlSchema,
  priceSchema,
  shopIdSchema,
} from '../../../../db/entities/item-sources/item-sources.schemas.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createItem } from '../admin-items.service.js'

const MAX_NAME_LENGTH = 300
const MAX_DESCRIPTION_LENGTH = 5000

const createItemSourceInputSchema = z
  .object({
    shopId: shopIdSchema.optional().transform((value) => value ?? null),
    sourceUrl: httpsSourceUrlSchema.optional().transform((value) => value ?? null),
    price: priceSchema.optional().transform((value) => value ?? null),
    currency: currencySchema.default('EUR'),
    isPrimary: z.boolean().default(false),
  })
  .strict()

const adminCreateItemSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    description: z
      .string()
      .trim()
      .max(MAX_DESCRIPTION_LENGTH)
      .nullable()
      .optional()
      .transform((value) => (value === '' ? null : (value ?? null))),
    imageUrl: logoUrlSchema.optional().transform((value) => value ?? null),
    moderationStatus: z.enum(MODERATION_STATUS_VALUES).default('approved'),
    sources: z
      .array(createItemSourceInputSchema)
      .min(1)
      .refine(
        (sources) => sources.filter((source) => source.isPrimary).length <= 1,
        { message: 'At most one source can be marked as primary' },
      ),
  })
  .strict()

export type CreateItemInput = z.infer<typeof adminCreateItemSchema>
export type CreateItemSourceEntry = z.infer<typeof createItemSourceInputSchema>

export function mountCreateItem(router: FeatureRouter): void {
  router.post(
    '/',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('json', adminCreateItemSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createItem(admin.id, input))
    },
  )
}
