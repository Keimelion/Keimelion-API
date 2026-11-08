import { zValidator } from '@hono/zod-validator'
import { adminItemsUpdateSourceRequestSchema } from '@keimelion/sdk/schemas'
import { itemSourceParamSchema } from '../../../../shared/schemas/params.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateItemSourceById } from '../admin-item-sources.service.js'

export function mountUpdateItemSource(router: FeatureRouter): void {
  router.patch(
    '/:id/sources/:sourceId',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('param', itemSourceParamSchema, validationErrorHandler),
    zValidator('json', adminItemsUpdateSourceRequestSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id, sourceId } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateItemSourceById(admin.id, id, sourceId, input))
    },
  )
}
