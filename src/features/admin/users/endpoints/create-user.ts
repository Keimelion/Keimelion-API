import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createRateLimiter } from '../../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { USER_ROLE_VALUES } from '../../../../shared/enums/user-role.js'
import { HonoContextKey } from '../../../../shared/enums/context-key.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import type { AppVariables } from '../../../../shared/types/app.js'
import { USERNAME_REGEX } from '../../../users/users.constants.js'
import { createUser } from '../admin-users.service.js'

const ADMIN_CREATE_USER_RATE_LIMIT = 20
const ADMIN_CREATE_USER_RATE_LIMIT_WINDOW_MS = 60_000

const adminCreateUserSchema = z
  .object({
    email: z.string().email().transform((value) => value.toLowerCase().trim()),
    username: z
      .string()
      .trim()
      .regex(USERNAME_REGEX)
      .nullish()
      .transform((value) => value ?? null),
    role: z.enum(USER_ROLE_VALUES),
  })
  .strict()

export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>

export function mountCreateUser(router: Hono<{ Variables: AppVariables }>): void {
  router.post(
    '/',
    ...adminOnly,
    createRateLimiter(ADMIN_CREATE_USER_RATE_LIMIT, ADMIN_CREATE_USER_RATE_LIMIT_WINDOW_MS),
    zValidator('json', adminCreateUserSchema, validationErrorHandler),
    async (context) => {
      const admin = context.get(HonoContextKey.USER)
      const input = context.req.valid('json')
      const { data, httpStatus } = await createUser(admin.id, input)
      return context.json(data, httpStatus as 201)
    },
  )
}
