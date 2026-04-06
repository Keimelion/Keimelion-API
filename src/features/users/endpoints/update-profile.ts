import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppVariables } from '../../../shared/types/app.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { updateProfile } from '../users.service.js'
import { USERNAME_REGEX } from '../users.constants.js'

const updateProfileSchema = z.object({
  username: z.string().trim().regex(USERNAME_REGEX).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  isMarketingOptedIn: z.boolean().optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export function mountUpdateProfile(router: Hono<{ Variables: AppVariables }>): void {
  router.patch('/me', zValidator('json', updateProfileSchema, validationErrorHandler), async (context) => {
    const user = context.get('user')
    const input = context.req.valid('json')
    const { data, httpStatus } = await updateProfile(user.id, input)
    return context.json(data, httpStatus as 200)
  })
}
