import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { optionalAuthMiddleware, getOptionalAuthUser } from '../../../shared/middlewares/optional-auth.js'
import { createFeedbackRateLimiters } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { createFeedback } from '../feedback.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export const MAX_FEEDBACK_TITLE_LENGTH = 200
export const MAX_FEEDBACK_DESCRIPTION_LENGTH = 10_000
export const MAX_FEEDBACK_CONTEXT_BYTES = 16 * 1024

function serializedByteLength(value: Record<string, unknown>): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

const feedbackContextSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (value) => serializedByteLength(value) <= MAX_FEEDBACK_CONTEXT_BYTES,
    { message: `Context must not exceed ${String(MAX_FEEDBACK_CONTEXT_BYTES)} bytes when serialized` },
  )

const createFeedbackSchema = z.object({
  title: z.string().trim().min(1).max(MAX_FEEDBACK_TITLE_LENGTH),
  description: z.string().trim().min(1).max(MAX_FEEDBACK_DESCRIPTION_LENGTH),
  context: feedbackContextSchema.nullable().optional(),
}).strict()

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>

export function mountCreateFeedback(router: FeatureRouter): void {
  const [perMinuteLimiter, perHourLimiter] = createFeedbackRateLimiters()
  router.post(
    '/',
    optionalAuthMiddleware,
    perMinuteLimiter,
    perHourLimiter,
    zValidator('json', createFeedbackSchema, validationErrorHandler),
    async (context) => {
      const user = getOptionalAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createFeedback(user?.id ?? null, input))
    },
  )
}
