import { zValidator } from '@hono/zod-validator'
import { adminShopsUpdateRequestSchema } from '@keimelion/sdk/schemas'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateShopById } from '../admin-shops.service.js'

export function mountUpdateShop(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', adminShopsUpdateRequestSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateShopById(admin.id, id, input))
    },
  )
}
