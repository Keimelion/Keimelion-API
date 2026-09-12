import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { refreshAccessToken } from '../auth.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export type RefreshInput = z.infer<typeof refreshSchema>

export function mountRefresh(router: FeatureRouter): void {
  router.post(
    '/refresh',
    RATE_LIMITS.SENSITIVE(),
    zValidator('json', refreshSchema, validationErrorHandler),
    async (context) => {
      const input = context.req.valid('json')
      return jsonResult(context, await refreshAccessToken(input.refreshToken))
    },
  )
}
