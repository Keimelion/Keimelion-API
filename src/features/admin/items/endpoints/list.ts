import { zValidator } from '@hono/zod-validator'
import type { AdminItemsListQueryParsed } from '@keimelion/sdk/schemas'
import { adminItemsListQuerySchema } from '@keimelion/sdk/schemas'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { ErrorCode } from '@keimelion/sdk/enums'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getLocale } from '../../../../shared/middlewares/resolve-locale.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'
import { listItems } from '../admin-items.service.js'
import { itemsEntity } from '../admin-items.repository.js'

export interface ListItemsInput extends AdminItemsListQueryParsed {
  genericFilters: FilterInput[]
}

export function mountListItems(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', adminItemsListQuerySchema, validationErrorHandler),
    async (context) => {
      const query = context.req.valid('query')
      const genericFilters = itemsEntity.validateFilters(context.req.url)

      if (genericFilters === null) {
        return sendError(ErrorCode.UNPROCESSABLE_ENTITY)
      }

      const locale = getLocale(context)
      return jsonResult(context, await listItems({ ...query, genericFilters }, locale))
    },
  )
}
