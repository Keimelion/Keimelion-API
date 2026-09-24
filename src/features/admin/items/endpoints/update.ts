import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { logoUrlSchema } from '../../../../db/entities/shops/shops.schemas.js'
import { MODERATION_STATUS_VALUES } from '../../../../shared/enums/moderation-status.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateItemById } from '../admin-items.service.js'

const MAX_NAME_LENGTH = 300
const MAX_DESCRIPTION_LENGTH = 5000

const adminUpdateItemSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
    description: z
      .string()
      .trim()
      .max(MAX_DESCRIPTION_LENGTH)
      .nullable()
      .optional()
      .transform((value) => (value === '' ? null : value)),
    imageUrl: logoUrlSchema.optional(),
    moderationStatus: z.enum(MODERATION_STATUS_VALUES).optional(),
  })
  .strict()

export type UpdateItemInput = z.infer<typeof adminUpdateItemSchema>

export function mountUpdateItem(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', adminUpdateItemSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateItemById(admin.id, id, input))
    },
  )
}
