import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { USER_ROLE_VALUES } from '../../../../shared/enums/user-role.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { USERNAME_REGEX } from '../../../users/users.constants.js'
import { createUser } from '../admin-users.service.js'

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

export function mountCreateUser(router: FeatureRouter): void {
  router.post(
    '/',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('json', adminCreateUserSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createUser(admin.id, input))
    },
  )
}
