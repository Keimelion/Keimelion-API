import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { multipartOnly, RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { adminItemsCreateRequestSchema } from '@keimelion/sdk/schemas'
import type { AdminItemsCreateRequestParsed } from '@keimelion/sdk/schemas'
import { getLocale } from '../../../../shared/middlewares/resolve-locale.js'
import { multipartJsonSchema, parseJsonOrMultipart, sendParseFailure } from '../../../uploads/multipart.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { createItem } from '../admin-items.service.js'

const { categories, sources, tags } = adminItemsCreateRequestSchema.shape

const multipartAdminCreateItemSchema = z
  .strictObject({
    ...adminItemsCreateRequestSchema.shape,
    sources: multipartJsonSchema(sources),
    categories: multipartJsonSchema(categories).optional(),
    tags: multipartJsonSchema(tags).optional(),
  })
  .check(...((adminItemsCreateRequestSchema.def.checks ?? []) as z.core.$ZodCheck<AdminItemsCreateRequestParsed>[]))

export function mountCreateItem(router: FeatureRouter): void {
  router.post(
    '/',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    multipartOnly(RATE_LIMITS.UPLOAD()),
    async (context) => {
      const parsed = await parseJsonOrMultipart(context, {
        jsonSchema: adminItemsCreateRequestSchema,
        multipartSchema: multipartAdminCreateItemSchema,
      })
      if (!parsed.ok) return sendParseFailure(parsed)

      const admin = getAuthUser(context)
      const locale = getLocale(context)
      const input = { ...parsed.data, imageBuffer: parsed.imageBuffer }
      return jsonResult(context, await createItem(admin.id, input, locale))
    },
  )
}
