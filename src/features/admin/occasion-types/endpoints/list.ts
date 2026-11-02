import { zValidator } from '@hono/zod-validator'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { listOccasionTypes } from '../admin-occasion-types.service.js'

export function mountListOccasionTypes(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', paginationQuerySchema, validationErrorHandler),
    async (context) => {
      const query = context.req.valid('query')
      return jsonResult(context, await listOccasionTypes(query))
    },
  )
}
