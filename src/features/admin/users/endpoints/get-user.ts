import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AppVariables } from '../../../../shared/types/app.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getUserById } from '../admin-users.service.js'

export function mountGetUser(router: Hono<{ Variables: AppVariables }>): void {
  router.get('/:id', zValidator('param', uuidParamSchema, validationErrorHandler), async (context) => {
    const { id } = context.req.valid('param')
    const { data, httpStatus } = await getUserById(id)
    return context.json(data, httpStatus as 200)
  })
}
