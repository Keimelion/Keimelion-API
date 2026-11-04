import type { Context, MiddlewareHandler } from 'hono'
import { ErrorCode } from '../enums/error-code.js'
import { HonoContextKey } from '../enums/context-key.js'
import { sendError } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { findListWithOwner } from '../../db/entities/lists/lists.repository.js'
import { CONTRIBUTOR_ROLE_VALUES, ListUserRoles } from '../enums/list-user-role.js'
import { getAuthUser } from './auth.js'
import type { AppVariables } from '../types/app.js'
import type { ListRowWithOwner } from '../types/list.js'

type AppContext = Context<{ Variables: AppVariables }>
type AccessCheck = (list: ListRowWithOwner, userId: string) => boolean

export interface ListAccessMiddlewareOptions {
  paramName: string
  resolveListId?: (context: AppContext) => Promise<string | null>
}

export function listOwnershipMiddleware(
  options: ListAccessMiddlewareOptions,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return buildListAccessMiddleware(options, isListOwner)
}

export function listContributorMiddleware(
  options: ListAccessMiddlewareOptions,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return buildListAccessMiddleware(options, isListContributor)
}

function buildListAccessMiddleware(
  options: ListAccessMiddlewareOptions,
  checkAccess: AccessCheck,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (context, next) => {
    try {
      const listId = await resolveListId(context, options)
      if (!listId) return sendError(ErrorCode.NOT_FOUND)

      const list = await findListWithOwner(listId, { excludeDeleted: true })
      if (!list) return sendError(ErrorCode.NOT_FOUND)

      const user = getAuthUser(context)
      if (!checkAccess(list, user.id)) return sendError(ErrorCode.FORBIDDEN)

      context.set(HonoContextKey.LIST, list)
      await next()
      return
    } catch (error: unknown) {
      logger.error({ error, path: context.req.path }, 'List access middleware failed')
      return sendError(ErrorCode.INTERNAL_ERROR)
    }
  }
}

export function getList(context: AppContext): ListRowWithOwner {
  return context.get(HonoContextKey.LIST)
}

async function resolveListId(
  context: AppContext,
  options: ListAccessMiddlewareOptions,
): Promise<string | null> {
  if (options.resolveListId) return options.resolveListId(context)
  const paramValue = context.req.param(options.paramName)
  return paramValue ?? null
}

function isListOwner(list: ListRowWithOwner, userId: string): boolean {
  return list.listUsers.some(
    (member) => member.userId === userId && member.role === ListUserRoles.OWNER,
  )
}

function isListContributor(list: ListRowWithOwner, userId: string): boolean {
  return list.listUsers.some(
    (member) => member.userId === userId && (CONTRIBUTOR_ROLE_VALUES as readonly string[]).includes(member.role),
  )
}
