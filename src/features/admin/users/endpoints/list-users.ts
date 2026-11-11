import { zValidator } from '@hono/zod-validator'
import type { AdminUsersListQueryParsed } from '@keimelion/sdk/schemas'
import { adminUsersListQuerySchema } from '@keimelion/sdk/schemas'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { ErrorCode } from '@keimelion/sdk/enums'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult, sendError } from '../../../../shared/utils/response.js'
import { listUsers } from '../admin-users.service.js'
import { usersEntity } from '../admin-users.repository.js'
import type { FilterInput } from '../../../../shared/db/filter-parser.js'

export interface ListUsersInput extends AdminUsersListQueryParsed {
  genericFilters: FilterInput[]
}

export function mountListUsers(router: FeatureRouter): void {
  router.get('/', ...adminOnly, zValidator('query', adminUsersListQuerySchema, validationErrorHandler), async (context) => {
    const query = context.req.valid('query')
    const genericFilters = usersEntity.validateFilters(context.req.url)

    if (genericFilters === null) {
      return sendError(ErrorCode.UNPROCESSABLE_ENTITY)
    }

    return jsonResult(context, await listUsers({ ...query, genericFilters }))
  })
}
