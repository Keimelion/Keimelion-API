import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { logoUrlSchema } from '../../../../db/entities/shops/shops.schemas.js'
import { MODERATION_STATUS_VALUES } from '../../../../shared/enums/moderation-status.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createItem } from '../admin-items.service.js'

const MAX_NAME_LENGTH = 300
const MAX_DESCRIPTION_LENGTH = 5000

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
  })
  .strict()

export type CreateItemInput = z.infer<typeof adminCreateItemSchema>

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
