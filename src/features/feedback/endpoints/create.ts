import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { optionalAuthMiddleware, getOptionalAuthUser } from '../../../shared/middlewares/optional-auth.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { createFeedback } from '../feedback.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export const MAX_FEEDBACK_TITLE_LENGTH = 200
export const MAX_FEEDBACK_DESCRIPTION_LENGTH = 10_000

const feedbackContextSchema = z.record(z.string(), z.unknown())

const createFeedbackSchema = z.object({
  title: z.string().trim().min(1).max(MAX_FEEDBACK_TITLE_LENGTH),
  description: z.string().trim().min(1).max(MAX_FEEDBACK_DESCRIPTION_LENGTH),
  context: feedbackContextSchema.nullable().optional(),
}).strict()

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>

export function mountCreateFeedback(router: FeatureRouter): void {
  router.post(
    '/',
    RATE_LIMITS.STANDARD(),
    optionalAuthMiddleware,
    zValidator('json', createFeedbackSchema, validationErrorHandler),
    async (context) => {
      const user = getOptionalAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createFeedback(user?.id ?? null, input))
    },
  )
}
