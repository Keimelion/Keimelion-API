import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createRateLimiter } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { passwordSchema } from '../../../shared/schemas/password.js'
import { HonoContextKey } from '../../../shared/enums/context-key.js'
import { changePassword } from '../users.service.js'
import type { AppVariables } from '../../../shared/types/app.js'

const changePasswordSchema = z
  .object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must differ from current password',
    path: ['newPassword'],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export function mountChangePassword(router: Hono<{ Variables: AppVariables }>): void {
  router.post(
    '/me/change-password',
    createRateLimiter(5),
    zValidator('json', changePasswordSchema, validationErrorHandler),
    async (context) => {
      const user = context.get(HonoContextKey.USER)
      const input = context.req.valid('json')
      const { data, httpStatus } = await changePassword(user.id, input)
      return context.json(data, httpStatus as 200)
    },
  )
}
