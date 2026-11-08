import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { multipartOnly, RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { updateProfile } from '../users.service.js'
import { usernameSchema, usersUpdateProfileRequestSchema } from '@keimelion/sdk/schemas'
import {
  multipartBoolSchema,
  parseJsonOrMultipart,
  sendParseFailure,
} from '../../uploads/multipart.js'
import type { UpdateUserProfileInput } from '../users.service.js'

const multipartUpdateProfileSchema = usersUpdateProfileRequestSchema.extend({
  username: usernameSchema.optional(),
  isMarketingOptedIn: multipartBoolSchema.optional(),
  clearAvatar: multipartBoolSchema.optional(),
})

export function mountUpdateProfile(router: FeatureRouter): void {
  router.patch('/me', authMiddleware, multipartOnly(RATE_LIMITS.UPLOAD()), async (context) => {
    const parsed = await parseJsonOrMultipart(context, {
      jsonSchema: usersUpdateProfileRequestSchema,
      multipartSchema: multipartUpdateProfileSchema,
    })
    if (!parsed.ok) {
      return sendParseFailure(parsed)
    }

    const user = getAuthUser(context)
    const { defaultCurrency, clearAvatar, ...rest } = parsed.data
    const serviceInput: UpdateUserProfileInput = {
      ...rest,
      ...(defaultCurrency !== undefined && { defaultCurrencyCode: defaultCurrency }),
      avatarBuffer: parsed.imageBuffer,
      clearAvatar: clearAvatar ?? false,
    }
    return jsonResult(context, await updateProfile(user.id, serviceInput))
  })
}
