import type { Context, MiddlewareHandler } from 'hono'
import { ErrorCode } from '../enums/error-code.js'
import { HonoContextKey } from '../enums/context-key.js'
import { sendError } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { findListById } from '../../db/entities/lists/lists.repository.js'
import { findListOwner, findListContributor } from '../../db/entities/list-collaborators/list-collaborators.repository.js'
import { getAuthUser } from './auth.js'
import type { AppVariables } from '../types/app.js'
import type { ListCollaborator } from '../../db/entities/list-collaborators/list-collaborators.schema.js'

type AppContext = Context<{ Variables: AppVariables }>
type ResolveCollaborator = (listId: string, userId: string) => Promise<ListCollaborator | undefined>

export interface ListAccessMiddlewareOptions {
  paramName: string
  resolveListId?: (context: AppContext) => Promise<string | null>
}

export function getListCollaborator(context: AppContext): ListCollaborator {
  return context.get(HonoContextKey.LIST_COLLABORATOR)
}

export function listOwnershipMiddleware(
  options: ListAccessMiddlewareOptions,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return buildListAccessMiddleware(options, findListOwner)
}

export function listContributorMiddleware(
  options: ListAccessMiddlewareOptions,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return buildListAccessMiddleware(options, findListContributor)
}

function buildListAccessMiddleware(
  options: ListAccessMiddlewareOptions,
  resolveCollaborator: ResolveCollaborator,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (context, next) => {
    try {
      const listId = await resolveListId(context, options)
      if (!listId) return sendError(ErrorCode.NOT_FOUND)

      const listExistsAndActive = await assertListActive(listId)
      if (!listExistsAndActive) return sendError(ErrorCode.NOT_FOUND)

      const collaborator = await assertUserHasAccess(context, listId, resolveCollaborator)
      if (!collaborator) return sendError(ErrorCode.FORBIDDEN)

      context.set(HonoContextKey.LIST_COLLABORATOR, collaborator)
      await next()
      return
    } catch (error: unknown) {
      logger.error({ error, path: context.req.path }, 'List access middleware failed')
      return sendError(ErrorCode.INTERNAL_ERROR)
    }
  }
}

async function resolveListId(
  context: AppContext,
  options: ListAccessMiddlewareOptions,
): Promise<string | null> {
  if (options.resolveListId) return options.resolveListId(context)
  const paramValue = context.req.param(options.paramName)
  return paramValue ?? null
}

async function assertListActive(listId: string): Promise<boolean> {
  const list = await findListById(listId)
  if (!list) return false
  return list.deletedAt === null
}

function assertUserHasAccess(
  context: AppContext,
  listId: string,
  resolveCollaborator: ResolveCollaborator,
): Promise<ListCollaborator | undefined> {
  const user = getAuthUser(context)
  return resolveCollaborator(listId, user.id)
}
