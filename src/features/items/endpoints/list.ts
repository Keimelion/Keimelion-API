import { zValidator } from '@hono/zod-validator'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { itemsListQuerySchema } from '@keimelion/sdk/schemas'
import { getLocale } from '../../../shared/middlewares/resolve-locale.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { listItems } from '../items.service.js'

export function mountListItems(router: FeatureRouter): void {
  router.get(
    '/',
    zValidator('query', itemsListQuerySchema, validationErrorHandler),
    async (context) => {
      const query = context.req.valid('query')
      const locale = getLocale(context)
      return jsonResult(context, await listItems(query, locale))
    },
  )
}
