import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import {
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_MAX_LIMIT,
  paginationQuerySchema,
} from '../../../../shared/schemas/pagination.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { getShopById } from '../admin-shops.service.js'

const GET_SHOP_ITEMS_DEFAULT_LIMIT = 50

const getShopQuerySchema = paginationQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(PAGINATION_DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION_MAX_LIMIT)
    .default(GET_SHOP_ITEMS_DEFAULT_LIMIT),
})

export function mountGetShop(router: FeatureRouter): void {
  router.get(
    '/:id',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('query', getShopQuerySchema, validationErrorHandler),
    async (context) => {
      const { id } = context.req.valid('param')
      const pagination = context.req.valid('query')
      return jsonResult(context, await getShopById(id, pagination))
    },
  )
}
