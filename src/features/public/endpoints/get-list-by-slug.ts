import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createSlugSchema } from '../../../shared/schemas/slug.js'
import { getLocale } from '../../../shared/middlewares/resolve-locale.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { getPublicListBySlug } from '../public-lists.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

const LIST_SLUG_MIN_LENGTH = 1
const LIST_SLUG_MAX_LENGTH = 80

const listSlugParamSchema = z.object({
  slug: createSlugSchema({
    min: LIST_SLUG_MIN_LENGTH,
    max: LIST_SLUG_MAX_LENGTH,
    example: 'my-wishlist-abc123',
  }),
})

export function mountGetPublicListBySlug(router: FeatureRouter): void {
  router.get(
    '/lists/:slug',
    RATE_LIMITS.PUBLIC(),
    zValidator('param', listSlugParamSchema, validationErrorHandler),
    async (context) => {
      const { slug } = context.req.valid('param')
      const locale = getLocale(context)
      return jsonResult(context, await getPublicListBySlug(slug, locale))
    },
  )
}
