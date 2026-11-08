import { zValidator } from '@hono/zod-validator'
import { adminUsersUpdateRequestSchema } from '@keimelion/sdk/schemas'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { updateUser } from '../admin-users.service.js'

export function mountUpdateUser(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', adminUsersUpdateRequestSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateUser(admin.id, id, input))
    },
  )
}
