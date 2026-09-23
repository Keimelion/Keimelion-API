import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { ErrorCode } from '../../../../shared/enums/error-code.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'
import { listItems } from '../admin-items.service.js'
import { itemsEntity } from '../admin-items.repository.js'

const listItemsQuerySchema = paginationQuerySchema.extend({
  sort: itemsEntity.buildListQuerySchema(),
})

export type ListItemsQueryInput = z.infer<typeof listItemsQuerySchema>

export interface ListItemsInput extends ListItemsQueryInput {
  genericFilters: FilterInput[]
}

export function mountListItems(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', listItemsQuerySchema, validationErrorHandler),
    async (context) => {
      const query = context.req.valid('query')
      const genericFilters = itemsEntity.validateFilters(context.req.url)

      if (genericFilters === null) {
        return sendError(ErrorCode.UNPROCESSABLE_ENTITY)
      }

      return jsonResult(context, await listItems({ ...query, genericFilters }))
    },
  )
}
