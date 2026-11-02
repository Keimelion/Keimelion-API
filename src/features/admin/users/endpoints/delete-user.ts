import { zValidator } from '@hono/zod-validator'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { deleteUser } from '../admin-users.service.js'

export function mountDeleteUser(router: FeatureRouter): void {
  router.delete('/:id', ...adminOnly, zValidator('param', uuidParamSchema, validationErrorHandler), async (context) => {
    const admin = getAuthUser(context)
    const { id } = context.req.valid('param')
    return jsonResult(context, await deleteUser(admin.id, id))
  })
}
