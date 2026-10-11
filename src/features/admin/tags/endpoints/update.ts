import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import {
  tagNameSchema,
  tagSlugSchema,
} from '../../../../db/entities/tags/tags.schemas.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateTagById } from '../admin-tags.service.js'

const adminUpdateTagSchema = z
  .object({
    name: tagNameSchema.optional(),
    slug: tagSlugSchema.optional(),
  })
  .strict()

export type UpdateTagInput = z.infer<typeof adminUpdateTagSchema>

export function mountUpdateTag(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', adminUpdateTagSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateTagById(admin.id, id, input))
    },
  )
}
