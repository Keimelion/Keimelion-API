import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { registerUser } from '../auth.service.js'
import { usernameSchema } from '../../../shared/schemas/username.js'
import { passwordSchema } from '../../../shared/schemas/password.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const registerSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  password: passwordSchema,
  username: usernameSchema
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  isMarketingOptedIn: z.boolean().default(false),
})

export type RegisterInput = z.infer<typeof registerSchema>

export function mountRegister(router: FeatureRouter): void {
  router.post('/register', RATE_LIMITS.STANDARD(), zValidator('json', registerSchema, validationErrorHandler), async (context) => {
    const input = context.req.valid('json')
    return jsonResult(context, await registerUser(input))
  })
}
