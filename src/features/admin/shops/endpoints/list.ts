import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { ErrorCode } from '../../../../shared/enums/error-code.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'
import { listShops } from '../admin-shops.service.js'
import { shopsEntity } from '../admin-shops.repository.js'

const listShopsQuerySchema = paginationQuerySchema.extend({
  sort: shopsEntity.buildListQuerySchema(),
})

export type ListShopsQueryInput = z.infer<typeof listShopsQuerySchema>

export interface ListShopsInput extends ListShopsQueryInput {
  genericFilters: FilterInput[]
}

export function mountListShops(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', listShopsQuerySchema, validationErrorHandler),
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
