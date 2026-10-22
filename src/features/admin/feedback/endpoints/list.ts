import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { ErrorCode } from '../../../../shared/enums/error-code.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'
import { listFeedback } from '../admin-feedback.service.js'
import { feedbackEntity } from '../admin-feedback.repository.js'

const listFeedbackQuerySchema = paginationQuerySchema.extend({
  sort: feedbackEntity.buildListQuerySchema(),
})

export type ListFeedbackQueryInput = z.infer<typeof listFeedbackQuerySchema>

export interface ListFeedbackInput extends ListFeedbackQueryInput {
  genericFilters: FilterInput[]
}

export function mountListFeedback(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', listFeedbackQuerySchema, validationErrorHandler),
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
