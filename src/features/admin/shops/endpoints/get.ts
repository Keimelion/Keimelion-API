import { zValidator } from '@hono/zod-validator'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { adminShopsGetQuerySchema } from '@keimelion/sdk/schemas'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { getShopById } from '../admin-shops.service.js'

export function mountGetShop(router: FeatureRouter): void {
  router.get(
    '/:id',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('query', adminShopsGetQuerySchema, validationErrorHandler),
    async (context) => {
      const { id } = context.req.valid('param')
      const pagination = context.req.valid('query')
      return jsonResult(context, await getShopById(id, pagination))
    },
  )
}
