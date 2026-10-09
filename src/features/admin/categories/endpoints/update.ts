import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import {
  categoryNameSchema,
  categorySlugSchema,
} from '../../../../db/entities/categories/categories.schemas.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateCategoryById } from '../admin-categories.service.js'

const adminUpdateCategorySchema = z
  .object({
    name: categoryNameSchema.optional(),
    slug: categorySlugSchema.optional(),
    parentId: z.string().uuid().nullable().optional(),
  })
  .strict()

export type UpdateCategoryInput = z.infer<typeof adminUpdateCategorySchema>

export function mountUpdateCategory(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', adminUpdateCategorySchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateCategoryById(admin.id, id, input))
    },
  )
}
