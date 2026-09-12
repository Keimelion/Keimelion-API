import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppVariables } from '../../../../shared/types/app.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { sortQuerySchema } from '../../../../shared/schemas/sort.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { listUsers } from '../admin-users.service.js'
import { USER_ROLE_VALUES } from '../../../../shared/enums/user-role.js'

const ADMIN_USERS_SORT_FIELDS = ['createdAt', 'email', 'lastActiveAt'] as const

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

export type ListUsersInput = z.infer<typeof listUsersQuerySchema>

export function mountListUsers(router: Hono<{ Variables: AppVariables }>): void {
  router.get('/', ...adminOnly, zValidator('query', listUsersQuerySchema, validationErrorHandler), async (context) => {
    const query = context.req.valid('query')
    const { data, httpStatus } = await listUsers(query)
    return context.json(data, httpStatus as 200)
  })
}
