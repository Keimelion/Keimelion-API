import { zValidator } from '@hono/zod-validator'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { getLocale } from '../../../../shared/middlewares/resolve-locale.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { listListItemsByListId } from '../admin-lists.service.js'

export function mountListListItems(router: FeatureRouter): void {
  router.get(
    '/:id/items',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('query', paginationQuerySchema, validationErrorHandler),
    async (context) => {
      const { id } = context.req.valid('param')
      const pagination = context.req.valid('query')
      const locale = getLocale(context)
      return jsonResult(context, await listListItemsByListId(id, pagination, locale))
    },
  )
}
