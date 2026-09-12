import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createRateLimiter } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { loginUser } from '../auth.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const loginSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  password: z.string().min(1),
})

export type LoginInput = z.infer<typeof loginSchema>

export function mountLogin(router: FeatureRouter): void {
  router.post('/login', createRateLimiter(5), zValidator('json', loginSchema, validationErrorHandler), async (context) => {
    const input = context.req.valid('json')
    return jsonResult(context, await loginUser(input))
  })
}
