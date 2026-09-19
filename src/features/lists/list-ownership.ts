import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { findListById } from '../../db/entities/lists/lists.repository.js'
import { findListOwner } from '../../db/entities/list-collaborators/list-collaborators.repository.js'
import type { ServiceResult } from '../../shared/types/service.js'

export async function requireListOwnership(
  listId: string,
  userId: string,
): Promise<ServiceResult<never> | null> {
  const list = await findListById(listId)
  if (!list || list.deletedAt) return serviceError(ErrorCode.NOT_FOUND)

  const owner = await findListOwner(listId, userId)
  if (!owner) return serviceError(ErrorCode.FORBIDDEN)

  return null
}
