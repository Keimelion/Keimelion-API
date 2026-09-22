import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { sortQuerySchema } from '../../../../shared/schemas/sort.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { ErrorCode } from '../../../../shared/enums/error-code.js'
import { listUsers } from '../admin-users.service.js'
import { makeFilterValidator } from '../../../../shared/db/filter-validator.js'
import { usersGenericFilterConfig } from '../admin-users.repository.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'

const ADMIN_USERS_SORT_FIELDS = ['createdAt', 'email', 'username', 'lastActiveAt'] as const

const listUsersQuerySchema = paginationQuerySchema.extend({
  sort: sortQuerySchema(ADMIN_USERS_SORT_FIELDS),
})

export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>

export interface ListUsersInput extends ListUsersQueryInput {
  genericFilters: FilterInput[]
}

const validateFilters = makeFilterValidator(usersGenericFilterConfig)

export function mountListUsers(router: FeatureRouter): void {
  router.get('/', ...adminOnly, zValidator('query', listUsersQuerySchema, validationErrorHandler), async (context) => {
    const query = context.req.valid('query')
    const genericFilters = validateFilters(context.req.url)

    if (genericFilters === null) {
      return sendError(ErrorCode.UNPROCESSABLE_ENTITY)
    }

    return jsonResult(context, await listUsers({ ...query, genericFilters }))
  })
}
