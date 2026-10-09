import { zValidator } from '@hono/zod-validator'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { getTagById } from '../admin-tags.service.js'

export function mountGetTag(router: FeatureRouter): void {
  router.get(
    '/:id',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    async (context) => {
      const { id } = context.req.valid('param')
      return jsonResult(context, await getTagById(id))
    },
  )
}
