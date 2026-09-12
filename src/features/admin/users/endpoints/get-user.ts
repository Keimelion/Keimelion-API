import { zValidator } from '@hono/zod-validator'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { getUserById } from '../admin-users.service.js'

export function mountGetUser(router: FeatureRouter): void {
  router.get('/:id', ...adminOnly, zValidator('param', uuidParamSchema, validationErrorHandler), async (context) => {
    const { id } = context.req.valid('param')
    return jsonResult(context, await getUserById(id))
  })
}
