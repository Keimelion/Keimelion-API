import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { updateProfile } from '../users.service.js'
import { USERNAME_REGEX } from '../users.constants.js'

const updateProfileSchema = z.object({
  username: z.string().trim().regex(USERNAME_REGEX).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  isMarketingOptedIn: z.boolean().optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export function mountUpdateProfile(router: FeatureRouter): void {
  router.patch('/me', authMiddleware, zValidator('json', updateProfileSchema, validationErrorHandler), async (context) => {
    const user = getAuthUser(context)
    const input = context.req.valid('json')
    return jsonResult(context, await updateProfile(user.id, input))
  })
}
