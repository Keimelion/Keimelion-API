import { zValidator } from '@hono/zod-validator'
import { adminOccasionTypesUpdateRequestSchema } from '@keimelion/sdk/schemas'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateOccasionTypeById } from '../admin-occasion-types.service.js'

export function mountUpdateOccasionType(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', adminOccasionTypesUpdateRequestSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateOccasionTypeById(admin.id, id, input))
    },
  )
}
