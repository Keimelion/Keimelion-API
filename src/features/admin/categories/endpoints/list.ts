import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { ErrorCode } from '../../../../shared/enums/error-code.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'
import { listCategories } from '../admin-categories.service.js'
import { categoriesEntity } from '../admin-categories.repository.js'

const listCategoriesQuerySchema = paginationQuerySchema.extend({
  sort: categoriesEntity.buildListQuerySchema(),
})

export type ListCategoriesQueryInput = z.infer<typeof listCategoriesQuerySchema>

export interface ListCategoriesInput extends ListCategoriesQueryInput {
  genericFilters: FilterInput[]
}

export function mountListCategories(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', listCategoriesQuerySchema, validationErrorHandler),
    async (context) => {
      const query = context.req.valid('query')
      const genericFilters = categoriesEntity.validateFilters(context.req.url)

      if (genericFilters === null) {
        return sendError(ErrorCode.UNPROCESSABLE_ENTITY)
      }

      return jsonResult(context, await listCategories({ ...query, genericFilters }))
    },
  )
}
