import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { assignCategoriesToItem } from '../items.service.js'

const MAX_CATEGORIES_PER_ITEM = 20

const assignCategoriesSchema = z
  .object({
    categoryIds: z.array(z.string().uuid()).max(MAX_CATEGORIES_PER_ITEM),
  })
  .strict()

export function mountAssignCategories(router: FeatureRouter): void {
  router.post(
    '/:id/categories',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', assignCategoriesSchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await assignCategoriesToItem(id, user.id, input.categoryIds))
    },
  )
}
