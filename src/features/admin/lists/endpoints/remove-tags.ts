import { zValidator } from '@hono/zod-validator'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { HttpStatus } from '../../../../shared/enums/http.js'
import { listTagParamSchema } from '../../../../db/entities/list-tags/list-tags.schemas.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { removeTagFromList } from '../admin-lists.service.js'

export function mountRemoveListTag(router: FeatureRouter): void {
  router.delete(
    '/:id/tags/:tagId',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('param', listTagParamSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id, tagId } = context.req.valid('param')
      const result = await removeTagFromList(admin.id, id, tagId)
      if (result.httpStatus !== HttpStatus.NO_CONTENT) {
        return jsonResult(context, result)
      }
      return context.body(null, HttpStatus.NO_CONTENT)
    },
  )
}
