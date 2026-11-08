import { zValidator } from '@hono/zod-validator'
import type { AdminFeedbackListQueryParsed } from '@keimelion/sdk/schemas'
import { adminFeedbackListQuerySchema } from '@keimelion/sdk/schemas'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { ErrorCode } from '@keimelion/sdk/enums'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'
import { listFeedback } from '../admin-feedback.service.js'
import { feedbackEntity } from '../admin-feedback.repository.js'

export interface ListFeedbackInput extends AdminFeedbackListQueryParsed {
  genericFilters: FilterInput[]
}

export function mountListFeedback(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', adminFeedbackListQuerySchema, validationErrorHandler),
    async (context) => {
      const query = context.req.valid('query')
      const genericFilters = feedbackEntity.validateFilters(context.req.url)

      if (genericFilters === null) {
        return sendError(ErrorCode.UNPROCESSABLE_ENTITY)
      }

      return jsonResult(context, await listFeedback({ ...query, genericFilters }))
    },
  )
}
