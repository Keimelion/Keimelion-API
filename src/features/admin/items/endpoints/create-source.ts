import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createItemSource } from '../admin-items.service.js'

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

const adminCreateItemSourceSchema = z
  .object({
    shopId: z.string().uuid().nullable().optional().transform((value) => value ?? null),
    sourceUrl: httpsSourceUrlSchema.optional().transform((value) => value ?? null),
    price: z.string().regex(PRICE_REGEX).nullable().optional().transform((value) => value ?? null),
    currency: z.string().length(CURRENCY_LENGTH).regex(CURRENCY_REGEX).default('EUR'),
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
