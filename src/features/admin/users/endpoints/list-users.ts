import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { sortQuerySchema } from '../../../../shared/schemas/sort.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { listUsers } from '../admin-users.service.js'
import { USER_ROLE_VALUES } from '../../../../shared/enums/user-role.js'
import { parseFilterQuery } from '../../../../shared/db/filter-parser.js'
import { buildFilterSchema } from '../../../../shared/db/filter-schema.js'
import { usersGenericFilterConfig } from '../admin-users.repository.js'
import { sendError } from '../../../../shared/utils/response.js'
import { HttpStatus } from '../../../../shared/enums/http.js'
import { ErrorCode } from '../../../../shared/enums/error-code.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'

const ADMIN_USERS_SORT_FIELDS = ['createdAt', 'email', 'username', 'lastActiveAt'] as const

const MAX_FILTER_STRING_LENGTH = 320

// z.enum(['true','false']) is intentional — z.coerce.boolean() would accept '1', 'yes', etc.
const booleanStringSchema = z.enum(['true', 'false']).transform((value) => value === 'true')

const listUsersQuerySchema = paginationQuerySchema
  .extend({
    email: z.string().trim().min(1).max(MAX_FILTER_STRING_LENGTH).optional(),
    username: z.string().trim().min(1).max(MAX_FILTER_STRING_LENGTH).optional(),
    role: z.enum(USER_ROLE_VALUES).optional(),
    isBanned: booleanStringSchema.optional(),
    isDeleted: booleanStringSchema.optional(),
    createdFrom: z.string().datetime({ offset: true }).optional(),
    createdTo: z.string().datetime({ offset: true }).optional(),
    sort: sortQuerySchema(ADMIN_USERS_SORT_FIELDS),
  })
  .refine(
    (data) => {
      if (data.createdFrom !== undefined && data.createdTo !== undefined) {
        return new Date(data.createdFrom) <= new Date(data.createdTo)
      }
      return true
    },
    { message: 'createdFrom must be before or equal to createdTo' },
  )

export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>

export interface ListUsersInput extends ListUsersQueryInput {
  genericFilters?: FilterInput[] | undefined
}

const genericFilterSchema = buildFilterSchema(usersGenericFilterConfig)

export function mountListUsers(router: FeatureRouter): void {
  router.get('/', ...adminOnly, zValidator('query', listUsersQuerySchema, validationErrorHandler), async (context) => {
    const query = context.req.valid('query')

    const rawFilters = parseFilterQuery(context.req.url)
    const filterValidation = genericFilterSchema.safeParse(rawFilters)

    if (!filterValidation.success) {
      return context.json(sendError(ErrorCode.UNPROCESSABLE_ENTITY), HttpStatus.UNPROCESSABLE_ENTITY)
    }

    return jsonResult(context, await listUsers({ ...query, genericFilters: filterValidation.data }))
  })
}
