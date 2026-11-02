import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { FEEDBACK_STATUS_VALUES } from '../../../../shared/enums/feedback-status.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateFeedbackStatusById } from '../admin-feedback.service.js'

const updateFeedbackSchema = z
  .object({
    status: z.enum(FEEDBACK_STATUS_VALUES),
  })
  .strict()

export function mountUpdateFeedback(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', updateFeedbackSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const { status } = context.req.valid('json')
      return jsonResult(context, await updateFeedbackStatusById(admin.id, id, status))
    },
  )
}
