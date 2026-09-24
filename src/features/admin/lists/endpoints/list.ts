import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { ErrorCode } from '../../../../shared/enums/error-code.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'
import { listLists } from '../admin-lists.service.js'
import { listsEntity } from '../admin-lists.repository.js'

const listListsQuerySchema = paginationQuerySchema.extend({
  sort: listsEntity.buildListQuerySchema(),
  ownerUserId: z.string().uuid().optional(),
})

export type ListListsQueryInput = z.infer<typeof listListsQuerySchema>

export interface ListListsInput extends ListListsQueryInput {
  genericFilters: FilterInput[]
}

export function mountListLists(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', listListsQuerySchema, validationErrorHandler),
    async (context) => {
      const query = context.req.valid('query')
      const genericFilters = listsEntity.validateFilters(context.req.url)

      if (genericFilters === null) {
        return sendError(ErrorCode.UNPROCESSABLE_ENTITY)
      }

      return jsonResult(context, await listLists({ ...query, genericFilters }))
    },
  )
}
