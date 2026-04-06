import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { verifyEmail } from '../auth.service.js'

const verifyEmailSchema = z.object({
  token: z.string().uuid(),
})

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>

export function mountVerifyEmail(router: Hono): void {
  router.post('/verify-email', zValidator('json', verifyEmailSchema, validationErrorHandler), async (context) => {
    const input = context.req.valid('json')
    const { data, httpStatus } = await verifyEmail(input)
    return context.json(data, httpStatus as 200)
  })
}
