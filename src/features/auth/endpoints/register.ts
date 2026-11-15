import { registerRequestSchema } from '@keimelion/sdk/schemas'
import { multipartOnly, RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { resolveEmailLocale } from '../../../shared/mail/mail.locale.js'
import { registerUser } from '../auth.service.js'
import {
  multipartBoolSchema,
  parseJsonOrMultipart,
  sendParseFailure,
} from '../../uploads/multipart.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const multipartRegisterSchema = registerRequestSchema.extend({
  isMarketingOptedIn: multipartBoolSchema.optional().transform((value) => value ?? false),
})

export function mountRegister(router: FeatureRouter): void {
  router.post('/register', RATE_LIMITS.STANDARD(), multipartOnly(RATE_LIMITS.UPLOAD()), async (context) => {
    const parsed = await parseJsonOrMultipart(context, {
      jsonSchema: registerRequestSchema,
      multipartSchema: multipartRegisterSchema,
    })
    if (!parsed.ok) {
      return sendParseFailure(parsed)
    }
    const emailLocale = resolveEmailLocale(context.req.header('Accept-Language'))
    return jsonResult(context, await registerUser(parsed.data, emailLocale, parsed.imageBuffer))
  })
}
