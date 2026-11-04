import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { getList, listContributorMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
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
    listContributorMiddleware({ paramName: 'id' }),
    async (context) => {
      return jsonResult(context, await getUserListById(getList(context)))
    },
  )
}
