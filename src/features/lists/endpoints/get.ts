import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { listOwnershipMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { getUserListById } from '../lists.service.js'

export function mountGetUserList(router: FeatureRouter): void {
  router.get(
    '/:id',
    authMiddleware,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    listOwnershipMiddleware({ paramName: 'id' }),
    async (context) => {
      const { id } = context.req.valid('param')
      return jsonResult(context, await getUserListById(id))
    },
  )
}
