import { z } from 'zod'
import type { Context } from 'hono'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult, sendError } from '../../../shared/utils/response.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { registerUser } from '../auth.service.js'
import { isMultipartRequest, parseMultipart } from '../../uploads/multipart.js'
import { usernameSchema } from '../../../shared/schemas/username.js'
import { passwordSchema } from '../../../shared/schemas/password.js'
import { supportedCurrencyEnum } from '../../../shared/schemas/currency.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const jsonRegisterSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  password: passwordSchema,
  username: usernameSchema
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  isMarketingOptedIn: z.boolean().default(false),
  defaultCurrency: supportedCurrencyEnum.optional(),
})

const multipartRegisterSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  password: passwordSchema,
  username: usernameSchema.optional().transform((value) => value ?? null),
  isMarketingOptedIn: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  defaultCurrency: supportedCurrencyEnum.optional(),
})

export type RegisterInput = z.infer<typeof jsonRegisterSchema>

export function mountRegister(router: FeatureRouter): void {
  router.post('/register', RATE_LIMITS.STANDARD(), async (context) => {
    if (isMultipartRequest(context)) return handleMultipart(context)
    return handleJson(context)
  })
}

async function handleJson(context: Context): Promise<Response> {
  let payload: unknown
  try {
    payload = await context.req.json()
  } catch {
    return sendError(ErrorCode.BAD_REQUEST)
  }
  const result = jsonRegisterSchema.safeParse(payload)
  if (!result.success) {
    return sendError(ErrorCode.UNPROCESSABLE_ENTITY, { issues: result.error.issues })
  }
  return jsonResult(context, await registerUser(result.data, null))
}

async function handleMultipart(context: Context): Promise<Response> {
  const parsed = await parseMultipart(context, 'image')
  if ('errorCode' in parsed) return sendError(parsed.errorCode)

  const result = multipartRegisterSchema.safeParse(parsed.fields)
  if (!result.success) {
    return sendError(ErrorCode.UNPROCESSABLE_ENTITY, { issues: result.error.issues })
  }
  const normalized = {
    ...result.data,
    isMarketingOptedIn: result.data.isMarketingOptedIn,
  }
  return jsonResult(context, await registerUser(normalized, parsed.imageBuffer))
}
