import { zValidator } from '@hono/zod-validator'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { getLocale } from '../../../../shared/middlewares/resolve-locale.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { displayCurrencyQuerySchema } from '../../../../shared/schemas/currency.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { listListItemsByListId } from '../admin-lists.service.js'
import { resolveDisplayCurrency } from '../display-currency.js'

const listListItemsQuerySchema = paginationQuerySchema.merge(displayCurrencyQuerySchema)

export function mountListListItems(router: FeatureRouter): void {
  router.get(
    '/:id/items',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('query', listListItemsQuerySchema, validationErrorHandler),
    async (context) => {
      const { id } = context.req.valid('param')
      const { currency: queryCurrency, ...pagination } = context.req.valid('query')
      const currency = resolveDisplayCurrency(queryCurrency, getAuthUser(context))
      const locale = getLocale(context)
      return jsonResult(context, await listListItemsByListId(id, pagination, locale, currency))
    },
  )
}
