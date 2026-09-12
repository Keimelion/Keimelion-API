import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createRateLimiter } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { passwordSchema } from '../../../shared/schemas/password.js'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { changePassword } from '../users.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

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

export function mountChangePassword(router: FeatureRouter): void {
  router.post(
    '/me/change-password',
    authMiddleware,
    createRateLimiter(5),
    zValidator('json', changePasswordSchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await changePassword(user.id, input))
    },
  )
}
