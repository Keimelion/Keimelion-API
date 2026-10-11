import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { tagNameSchema } from '../../../../db/entities/tags/tags.schemas.js'
import { MAX_TAGS_PER_LIST } from '../../../../db/entities/list-tags/list-tags.schemas.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { assignTagsToList } from '../admin-lists.service.js'

const assignTagsSchema = z
  .object({
    names: z
      .array(tagNameSchema)
      .max(MAX_TAGS_PER_LIST, `names must contain at most ${String(MAX_TAGS_PER_LIST)} tags`),
  })
  .strict()

export function mountAssignListTags(router: FeatureRouter): void {
  router.post(
    '/:id/tags',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', assignTagsSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await assignTagsToList(admin.id, id, input.names))
    },
  )
}
