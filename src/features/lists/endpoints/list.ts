import { zValidator } from '@hono/zod-validator'
import { listsListQuerySchema } from '@keimelion/sdk/schemas'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { listUserLists } from '../lists.service.js'

export function mountListUserLists(router: FeatureRouter): void {
  router.get(
    '/',
    authMiddleware,
    zValidator('query', listsListQuerySchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const query = context.req.valid('query')
      return jsonResult(context, await listUserLists(user.id, query))
    },
  )
}
