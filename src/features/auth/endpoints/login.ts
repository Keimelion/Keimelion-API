import { zValidator } from '@hono/zod-validator'
import { loginRequestSchema } from '@keimelion/sdk/schemas'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { loginUser } from '../auth.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountLogin(router: FeatureRouter): void {
  router.post('/login', RATE_LIMITS.STRICT(), zValidator('json', loginRequestSchema, validationErrorHandler), async (context) => {
    const input = context.req.valid('json')
    return jsonResult(context, await loginUser(input))
  })
}
