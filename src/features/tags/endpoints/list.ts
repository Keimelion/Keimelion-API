import { zValidator } from '@hono/zod-validator'
import { tagsListQuerySchema } from '@keimelion/sdk/schemas'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { listPublicTags } from '../tags.service.js'

export function mountListTags(router: FeatureRouter): void {
  router.get(
    '/',
    authMiddleware,
    zValidator('query', tagsListQuerySchema, validationErrorHandler),
    async (context) => {
      const { page, limit, name } = context.req.valid('query')
      return jsonResult(
        context,
        await listPublicTags(name === undefined ? { page, limit } : { page, limit, name }),
      )
    },
  )
}
