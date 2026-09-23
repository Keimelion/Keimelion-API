import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { deleteItemSourceById } from '../admin-items.service.js'

const itemSourceParamSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
})

export function mountDeleteItemSource(router: FeatureRouter): void {
  router.delete(
    '/:id/sources/:sourceId',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('param', itemSourceParamSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id, sourceId } = context.req.valid('param')
      return jsonResult(context, await deleteItemSourceById(admin.id, id, sourceId))
    },
  )
}
