import { zValidator } from '@hono/zod-validator'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { HttpStatus } from '../../../../shared/enums/http.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { deleteTagById } from '../admin-tags.service.js'

export function mountDeleteTag(router: FeatureRouter): void {
  router.delete(
    '/:id',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const result = await deleteTagById(admin.id, id)
      if (result.httpStatus !== HttpStatus.NO_CONTENT) {
        return jsonResult(context, result)
      }
      return context.body(null, HttpStatus.NO_CONTENT)
    },
  )
}
