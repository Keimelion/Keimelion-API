import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { verifyEmail } from '../auth.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const verifyEmailSchema = z.object({
  token: z.string().uuid(),
})

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>

export function mountVerifyEmail(router: FeatureRouter): void {
  router.post('/verify-email', zValidator('json', verifyEmailSchema, validationErrorHandler), async (context) => {
    const input = context.req.valid('json')
    return jsonResult(context, await verifyEmail(input))
  })
}
