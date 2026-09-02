import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createRateLimiter } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { registerUser } from '../auth.service.js'
import { USERNAME_REGEX } from '../../users/users.constants.js'
import { passwordSchema } from '../../../shared/schemas/password.js'
import type { AppVariables } from '../../../shared/types/app.js'

const registerSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  password: passwordSchema,
  username: z.string().trim().regex(USERNAME_REGEX).nullable().optional().transform(v => v ?? null),
  isMarketingOptedIn: z.boolean().default(false),
})

export type RegisterInput = z.infer<typeof registerSchema>

export function mountRegister(router: Hono<{ Variables: AppVariables }>): void {
  router.post('/register', createRateLimiter(10), zValidator('json', registerSchema, validationErrorHandler), async (context) => {
    const input = context.req.valid('json')
    const { data, httpStatus } = await registerUser(input)
    return context.json(data, httpStatus as 201)
  })
}
