import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { ErrorCode } from '@keimelion/sdk/enums'
import type { SupportedCurrency } from '@keimelion/sdk/enums'
import { displayCurrencyQuerySchema, paginationQuerySchema } from '@keimelion/sdk/schemas'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'
import { listLists } from '../admin-lists.service.js'
import { listsEntity } from '../admin-lists.repository.js'
import { resolveDisplayCurrency } from '../display-currency.js'

const listListsQuerySchema = paginationQuerySchema
  .extend(displayCurrencyQuerySchema.shape)
  .extend({
    sort: listsEntity.buildListQuerySchema(),
    ownerUserId: z.guid().optional(),
  })

export type ListListsQueryInput = z.infer<typeof listListsQuerySchema>

export interface ListListsInput extends Omit<ListListsQueryInput, 'currency'> {
  currency: SupportedCurrency
  genericFilters: FilterInput[]
}

export function mountListLists(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', listListsQuerySchema, validationErrorHandler),
    async (context) => {
      const { currency: queryCurrency, ...rest } = context.req.valid('query')
      const currency = resolveDisplayCurrency(queryCurrency, getAuthUser(context))
      const genericFilters = listsEntity.validateFilters(context.req.url)

      if (genericFilters === null) {
        return sendError(ErrorCode.UNPROCESSABLE_ENTITY)
      }

      return jsonResult(context, await listLists({ ...rest, currency, genericFilters }))
    },
  )
}
