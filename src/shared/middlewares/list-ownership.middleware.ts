import type { Context, MiddlewareHandler } from 'hono'
import { ErrorCode } from '../enums/error-code.js'
import { HonoContextKey } from '../enums/context-key.js'
import { sendError } from '../utils/response.js'
import { findListById } from '../../db/entities/lists/lists.repository.js'
import { findListOwner, findListContributor } from '../../db/entities/list-collaborators/list-collaborators.repository.js'
import { getAuthUser } from './auth.js'
import type { AppVariables } from '../types/app.js'
import type { ListCollaborator } from '../../db/entities/list-collaborators/list-collaborators.schema.js'

type AppContext = Context<{ Variables: AppVariables }>

export interface ListOwnershipMiddlewareOptions {
  paramName: string
  resolveListId?: (context: AppContext) => Promise<string | null>
}

export function getListCollaborator(context: AppContext): ListCollaborator {
  return context.get(HonoContextKey.LIST_COLLABORATOR)
}

export function listOwnershipMiddleware(
  options: ListOwnershipMiddlewareOptions,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (context, next) => {
    const user = getAuthUser(context)
    const listId = await resolveListIdFromContext(context as AppContext, options)
    if (!listId) return sendError(ErrorCode.NOT_FOUND)

    const listExists = await checkListExists(listId)
    if (!listExists) return sendError(ErrorCode.NOT_FOUND)

    const collaborator = await findListOwner(listId, user.id)
    if (!collaborator) return sendError(ErrorCode.FORBIDDEN)

    context.set(HonoContextKey.LIST_COLLABORATOR, collaborator)
    return next()
  }
}

export function listContributorMiddleware(
  options: ListOwnershipMiddlewareOptions,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (context, next) => {
    const user = getAuthUser(context)
    const listId = await resolveListIdFromContext(context as AppContext, options)
    if (!listId) return sendError(ErrorCode.NOT_FOUND)

    const listExists = await checkListExists(listId)
    if (!listExists) return sendError(ErrorCode.NOT_FOUND)

    const collaborator = await findListContributor(listId, user.id)
    if (!collaborator) return sendError(ErrorCode.FORBIDDEN)

    context.set(HonoContextKey.LIST_COLLABORATOR, collaborator)
    return next()
  }
}

async function resolveListIdFromContext(
  context: AppContext,
  options: ListOwnershipMiddlewareOptions,
): Promise<string | null> {
  if (options.resolveListId) return options.resolveListId(context)
  const paramValue = context.req.param(options.paramName)
  return paramValue ?? null
}

async function checkListExists(listId: string): Promise<boolean> {
  const list = await findListById(listId)
  return !(!list || list.deletedAt)
}
