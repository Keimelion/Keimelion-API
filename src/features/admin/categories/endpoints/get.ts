import { zValidator } from '@hono/zod-validator'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { getCategoryById } from '../admin-categories.service.js'

export function mountGetCategory(router: FeatureRouter): void {
  router.get(
    '/:id',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    async (context) => {
      const { id } = context.req.valid('param')
      return jsonResult(context, await getCategoryById(id))
    },
  )
}
