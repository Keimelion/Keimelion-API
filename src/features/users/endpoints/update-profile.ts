import { z } from 'zod'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { jsonResult, sendError } from '../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { updateProfile } from '../users.service.js'
import { usernameSchema } from '../../../shared/schemas/username.js'
import { urlSchema } from '../../../shared/schemas/url.js'
import { supportedCurrencyEnum } from '../../../shared/schemas/currency.js'
import {
  multipartBoolSchema,
  parseJsonOrMultipart,
} from '../../uploads/multipart.js'
import type { UpdateUserProfileInput } from '../users.service.js'

const jsonUpdateProfileSchema = z.object({
  username: usernameSchema.nullable().optional(),
  avatarUrl: urlSchema('avatarUrl').nullable().optional(),
  isMarketingOptedIn: z.boolean().optional(),
  defaultCurrency: supportedCurrencyEnum.optional(),
  clearAvatar: z.boolean().optional(),
})

const multipartUpdateProfileSchema = z.object({
  username: usernameSchema.optional(),
  avatarUrl: urlSchema('avatarUrl').optional(),
  isMarketingOptedIn: multipartBoolSchema.optional(),
  defaultCurrency: supportedCurrencyEnum.optional(),
  clearAvatar: multipartBoolSchema.optional(),
})

export function mountUpdateProfile(router: FeatureRouter): void {
  router.patch('/me', authMiddleware, async (context) => {
    const parsed = await parseJsonOrMultipart(context, {
      jsonSchema: jsonUpdateProfileSchema,
      multipartSchema: multipartUpdateProfileSchema,
    })
    if (!parsed.ok) {
      return sendError(parsed.errorCode, parsed.issues ? { issues: parsed.issues } : {})
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
