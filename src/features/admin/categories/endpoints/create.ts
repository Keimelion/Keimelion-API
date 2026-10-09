import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { shopSlugSchema } from '../../../../db/entities/shops/shops.schemas.js'
import { MAX_CATEGORY_NAME_LENGTH } from '../../../../db/entities/categories/categories.schema.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createCategory } from '../admin-categories.service.js'

const categoryNameSchema = z.string().trim().min(1).max(MAX_CATEGORY_NAME_LENGTH)

const adminCreateCategorySchema = z
  .object({
    name: categoryNameSchema,
    slug: shopSlugSchema,
    parentId: z.string().uuid().nullable().optional().transform((value) => value ?? null),
  })
  .strict()

export type CreateCategoryInput = z.infer<typeof adminCreateCategorySchema>

export function mountCreateCategory(router: FeatureRouter): void {
  router.post(
    '/',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('json', adminCreateCategorySchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createCategory(admin.id, input))
    },
  )
}
