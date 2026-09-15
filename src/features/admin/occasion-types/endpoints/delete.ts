import { zValidator } from '@hono/zod-validator'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { HttpStatus } from '../../../../shared/enums/http.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { deleteOccasionTypeById } from '../admin-occasion-types.service.js'

export function mountDeleteOccasionType(router: FeatureRouter): void {
  router.delete(
    '/:id',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const result = await deleteOccasionTypeById(admin.id, id)
      if (result.httpStatus !== HttpStatus.NO_CONTENT) {
        return jsonResult(context, result)
      }
      return context.body(null, HttpStatus.NO_CONTENT)
    },
  )
}
