import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AppVariables } from '../../../../shared/types/app.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { deleteUser } from '../admin-users.service.js'

export function mountDeleteUser(router: Hono<{ Variables: AppVariables }>): void {
  router.delete('/:id', zValidator('param', uuidParamSchema, validationErrorHandler), async (context) => {
    const admin = context.get('user')
    const { id } = context.req.valid('param')
    const { data, httpStatus } = await deleteUser(admin.id, id)
    return context.json(data, httpStatus as 200)
  })
}
