import { z } from 'zod'
import type { Context } from 'hono'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { jsonResult, sendError } from '../../../shared/utils/response.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import type { AppVariables, FeatureRouter } from '../../../shared/types/app.js'
import { updateProfile } from '../users.service.js'
import { usernameSchema } from '../../../shared/schemas/username.js'
import { urlSchema } from '../../../shared/schemas/url.js'
import { supportedCurrencyEnum } from '../../../shared/schemas/currency.js'
import { isMultipartRequest, parseBooleanField, parseMultipart } from '../../uploads/multipart.js'
import type { UpdateUserProfileInput } from '../users.service.js'

type AppContext = Context<{ Variables: AppVariables }>

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
  isMarketingOptedIn: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  defaultCurrency: supportedCurrencyEnum.optional(),
})

export function mountUpdateProfile(router: FeatureRouter): void {
  router.patch('/me', authMiddleware, async (context) => {
    if (isMultipartRequest(context)) return handleMultipart(context)
    return handleJson(context)
  })
}

async function handleJson(context: AppContext): Promise<Response> {
  let payload: unknown
  try {
    payload = await context.req.json()
  } catch {
    return sendError(ErrorCode.BAD_REQUEST)
  }
  const result = jsonUpdateProfileSchema.safeParse(payload)
  if (!result.success) {
    return sendError(ErrorCode.UNPROCESSABLE_ENTITY, { issues: result.error.issues })
  }
  const user = getAuthUser(context)
  const { defaultCurrency, clearAvatar, ...rest } = result.data
  const serviceInput: UpdateUserProfileInput = {
    ...rest,
    ...(defaultCurrency !== undefined && { defaultCurrencyCode: defaultCurrency }),
    avatarBuffer: null,
    clearAvatar: clearAvatar ?? false,
  }
  return jsonResult(context, await updateProfile(user.id, serviceInput))
}

async function handleMultipart(context: AppContext): Promise<Response> {
  const parsed = await parseMultipart(context, 'image')
  if ('errorCode' in parsed) return sendError(parsed.errorCode)

  const result = multipartUpdateProfileSchema.safeParse(parsed.fields)
  if (!result.success) {
    return sendError(ErrorCode.UNPROCESSABLE_ENTITY, { issues: result.error.issues })
  }
  const user = getAuthUser(context)
  const { defaultCurrency, ...rest } = result.data
  const clearAvatar = parseBooleanField(parsed.fields.clear_avatar)
  const serviceInput: UpdateUserProfileInput = {
    ...rest,
    ...(defaultCurrency !== undefined && { defaultCurrencyCode: defaultCurrency }),
    avatarBuffer: parsed.imageBuffer,
    clearAvatar,
  }
  return jsonResult(context, await updateProfile(user.id, serviceInput))
}
