import { z } from 'zod'
import { multipartOnly, RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult, sendError } from '../../../shared/utils/response.js'
import { registerUser } from '../auth.service.js'
import {
  multipartBoolSchema,
  parseJsonOrMultipart,
} from '../../uploads/multipart.js'
import { usernameSchema } from '../../../shared/schemas/username.js'
import { passwordSchema } from '../../../shared/schemas/password.js'
import { supportedCurrencyEnum } from '../../../shared/schemas/currency.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const emailSchema = z.string().email().transform((v) => v.toLowerCase().trim())
const optionalUsernameSchema = usernameSchema
  .nullable()
  .optional()
  .transform((value) => value ?? null)

const jsonRegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: optionalUsernameSchema,
  isMarketingOptedIn: z.boolean().default(false),
  defaultCurrency: supportedCurrencyEnum.optional(),
})

const multipartRegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: optionalUsernameSchema,
  isMarketingOptedIn: multipartBoolSchema.optional().transform((value) => value ?? false),
  defaultCurrency: supportedCurrencyEnum.optional(),
})

export type RegisterInput = z.infer<typeof jsonRegisterSchema>

export function mountRegister(router: FeatureRouter): void {
  router.post('/register', RATE_LIMITS.STANDARD(), multipartOnly(RATE_LIMITS.UPLOAD()), async (context) => {
    const parsed = await parseJsonOrMultipart(context, {
      jsonSchema: jsonRegisterSchema,
      multipartSchema: multipartRegisterSchema,
    })
    if (!parsed.ok) {
      return sendError(parsed.errorCode, parsed.issues ? { issues: parsed.issues } : {})
    }
    return jsonResult(context, await registerUser(parsed.data, parsed.imageBuffer))
  })
}
