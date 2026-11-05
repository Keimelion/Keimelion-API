import type { MiddlewareHandler } from 'hono'
import { ErrorCode, UserRoles } from '@keimelion/sdk/enums'
import { HonoContextKey } from '../enums/context-key.js'
import { sendError } from '../utils/response.js'
import type { AppVariables } from '../types/app.js'

export const requireAdminMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (context, next) => {
  const user = context.get(HonoContextKey.USER)

  if (user.role !== UserRoles.ADMIN) {
    return sendError(ErrorCode.FORBIDDEN)
  }

  return next()
}
