import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { paginationQuerySchema } from '../../../shared/schemas/pagination.js'
import { MAX_TAG_NAME_LENGTH } from '../../../db/entities/tags/tags.schema.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { listPublicTags } from '../tags.service.js'

const listTagsPublicQuerySchema = paginationQuerySchema.extend({
  name: z.string().trim().min(1).max(MAX_TAG_NAME_LENGTH).optional(),
})

export function mountListTags(router: FeatureRouter): void {
  router.get(
    '/',
    authMiddleware,
    zValidator('query', listTagsPublicQuerySchema, validationErrorHandler),
    async (context) => {
      const { page, limit, name } = context.req.valid('query')
      return jsonResult(
        context,
        await listPublicTags(name === undefined ? { page, limit } : { page, limit, name }),
      )
    },
  )
}
