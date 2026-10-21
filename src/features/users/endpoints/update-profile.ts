import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { updateProfile } from '../users.service.js'
import { usernameSchema } from '../../../shared/schemas/username.js'
import { urlSchema } from '../../../shared/schemas/url.js'
import { supportedCurrencyEnum } from '../../../shared/schemas/currency.js'
import type { PartialWrite } from '../../../shared/types/api.js'
import type { UserWrite } from '../../../shared/types/user.js'

const updateProfileSchema = z.object({
  username: usernameSchema.nullable().optional(),
  avatarUrl: urlSchema('avatarUrl').nullable().optional(),
  isMarketingOptedIn: z.boolean().optional(),
  defaultCurrency: supportedCurrencyEnum.optional(),
})

export function mountUpdateProfile(router: FeatureRouter): void {
  router.patch('/me', authMiddleware, zValidator('json', updateProfileSchema, validationErrorHandler), async (context) => {
    const user = getAuthUser(context)
    const { defaultCurrency, ...rest } = context.req.valid('json')
    const serviceInput: PartialWrite<UserWrite> = {
      ...rest,
      ...(defaultCurrency !== undefined && { defaultCurrencyCode: defaultCurrency }),
    }
    return jsonResult(context, await updateProfile(user.id, serviceInput))
  })
}
