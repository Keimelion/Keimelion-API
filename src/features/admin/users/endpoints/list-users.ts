import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AppVariables } from '../../../../shared/types/app.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { listUsers } from '../admin-users.service.js'

export function mountListUsers(router: Hono<{ Variables: AppVariables }>): void {
  router.get('/', zValidator('query', paginationQuerySchema, validationErrorHandler), async (context) => {
    const query = context.req.valid('query')
    const { data, httpStatus } = await listUsers(query)
    return context.json(data, httpStatus as 200)
  })
}
