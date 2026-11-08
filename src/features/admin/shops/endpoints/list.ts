import { zValidator } from '@hono/zod-validator'
import type { AdminShopsListQueryParsed } from '@keimelion/sdk/schemas'
import { adminShopsListQuerySchema } from '@keimelion/sdk/schemas'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { ErrorCode } from '@keimelion/sdk/enums'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'
import { listShops } from '../admin-shops.service.js'
import { shopsEntity } from '../admin-shops.repository.js'

export interface ListShopsInput extends AdminShopsListQueryParsed {
  genericFilters: FilterInput[]
}

export function mountListShops(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', adminShopsListQuerySchema, validationErrorHandler),
    async (context) => {
      const query = context.req.valid('query')
      const genericFilters = shopsEntity.validateFilters(context.req.url)

      if (genericFilters === null) {
        return sendError(ErrorCode.UNPROCESSABLE_ENTITY)
      }

      return jsonResult(context, await listShops({ ...query, genericFilters }))
    },
  )
}
