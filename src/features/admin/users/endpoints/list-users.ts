import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { ErrorCode } from '../../../../shared/enums/error-code.js'
import { listUsers } from '../admin-users.service.js'
import { usersEntity } from '../admin-users.repository.js'
import type { UsersSortField } from '../admin-users.repository.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'

const listUsersQuerySchema = paginationQuerySchema.extend({
  sort: usersEntity.buildListQuerySchema(),
})

export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>

export interface ListUsersInput extends ListUsersQueryInput {
  genericFilters: FilterInput[]
  sort?: { field: UsersSortField; direction: 'asc' | 'desc' } | undefined
}

export function mountListUsers(router: FeatureRouter): void {
  router.get('/', ...adminOnly, zValidator('query', listUsersQuerySchema, validationErrorHandler), async (context) => {
    const query = context.req.valid('query')
    const genericFilters = usersEntity.validateFilters(context.req.url)

    if (genericFilters === null) {
      return sendError(ErrorCode.UNPROCESSABLE_ENTITY)
    }

    return jsonResult(context, await listUsers({ ...query, genericFilters }))
  })
}
