import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { listOwnershipMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { tagNameSchema } from '../../../db/entities/tags/tags.schemas.js'
import { MAX_TAGS_PER_LIST } from '../../../db/entities/list-tags/list-tags.schemas.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { assignTagsToList } from '../lists.service.js'

const assignTagsSchema = z
  .object({
    names: z
      .array(tagNameSchema)
      .max(MAX_TAGS_PER_LIST, `names must contain at most ${String(MAX_TAGS_PER_LIST)} tags`),
  })
  .strict()

export function mountAssignTags(router: FeatureRouter): void {
  router.post(
    '/:id/tags',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', assignTagsSchema, validationErrorHandler),
    listOwnershipMiddleware({ paramName: 'id' }),
    async (context) => {
      const user = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await assignTagsToList(id, user.id, input.names))
    },
  )
}
