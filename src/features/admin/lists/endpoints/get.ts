import { zValidator } from '@hono/zod-validator'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { displayCurrencyQuerySchema } from '../../../../shared/schemas/currency.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { getListById } from '../admin-lists.service.js'

export function mountGetList(router: FeatureRouter): void {
  router.get(
    '/:id',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('query', displayCurrencyQuerySchema, validationErrorHandler),
    async (context) => {
      const { id } = context.req.valid('param')
      const { currency } = context.req.valid('query')
      return jsonResult(context, await getListById(id, currency))
    },
  )
}
