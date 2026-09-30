import { zValidator } from '@hono/zod-validator'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { paginationQuerySchema } from '../../../shared/schemas/pagination.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { listItems } from '../items.service.js'

export function mountListItems(router: FeatureRouter): void {
  router.get(
    '/',
    zValidator('query', paginationQuerySchema, validationErrorHandler),
    async (context) => {
      const query = context.req.valid('query')
      return jsonResult(context, await listItems(query))
    },
  )
}
