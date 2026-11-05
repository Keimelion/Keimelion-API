import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { ErrorCode } from '@keimelion/sdk/enums'
import { paginationQuerySchema } from '@keimelion/sdk/schemas'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'
import { listTags } from '../admin-tags.service.js'
import { tagsEntity } from '../admin-tags.repository.js'

const listTagsQuerySchema = paginationQuerySchema.extend({
  sort: tagsEntity.buildListQuerySchema(),
})

export type ListTagsQueryInput = z.infer<typeof listTagsQuerySchema>

export interface ListTagsInput extends ListTagsQueryInput {
  genericFilters: FilterInput[]
}

export function mountListTags(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', listTagsQuerySchema, validationErrorHandler),
    async (context) => {
      const query = context.req.valid('query')
      const genericFilters = tagsEntity.validateFilters(context.req.url)

      if (genericFilters === null) {
        return sendError(ErrorCode.UNPROCESSABLE_ENTITY)
      }

      return jsonResult(context, await listTags({ ...query, genericFilters }))
    },
  )
}
