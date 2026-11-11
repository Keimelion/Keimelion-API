import { zValidator } from '@hono/zod-validator'
import type { AdminTagsListQueryParsed } from '@keimelion/sdk/schemas'
import { adminTagsListQuerySchema } from '@keimelion/sdk/schemas'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { ErrorCode } from '@keimelion/sdk/enums'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'
import { listTags } from '../admin-tags.service.js'
import { tagsEntity } from '../admin-tags.repository.js'

export interface ListTagsInput extends AdminTagsListQueryParsed {
  genericFilters: FilterInput[]
}

export function mountListTags(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', adminTagsListQuerySchema, validationErrorHandler),
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
