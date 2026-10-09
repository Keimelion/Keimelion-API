import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { tagNameSchema } from '../../../../db/entities/tags/tags.schemas.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createTag } from '../admin-tags.service.js'

const adminCreateTagSchema = z
  .object({
    name: tagNameSchema,
  })
  .strict()

export type CreateTagInput = z.infer<typeof adminCreateTagSchema>

export function mountCreateTag(router: FeatureRouter): void {
  router.post(
    '/',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('json', adminCreateTagSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const input = context.req.valid('json')
      return jsonResult(context, await createTag(admin.id, input))
    },
  )
}
