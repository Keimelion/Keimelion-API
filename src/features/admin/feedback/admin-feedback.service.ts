import { buildPaginatedResponse } from '../../../shared/utils/pagination.js'
import { ErrorCode, HttpStatus } from '@keimelion/sdk/enums'
import type { FeedbackStatus } from '@keimelion/sdk/enums'
import type { PaginatedResponse } from '@keimelion/sdk/schemas'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import {
  findAllFeedback,
  countFeedback,
  findFeedbackById,
  updateFeedbackStatus,
} from './admin-feedback.repository.js'
import { toAdminFeedback } from './admin-feedback.mapper.js'
import { AdminAction } from '../admin.enums.js'
import type { AdminFeedback } from './admin-feedback.mapper.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { ListFeedbackInput } from './endpoints/list.js'

export async function listFeedback(
  input: ListFeedbackInput,
): Promise<ServiceResult<PaginatedResponse<AdminFeedback>>> {
  const [rows, total] = await Promise.all([findAllFeedback(input, input), countFeedback(input)])

  return {
    data: buildPaginatedResponse(rows.map(toAdminFeedback), input, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function updateFeedbackStatusById(
  adminId: string,
  id: string,
  status: FeedbackStatus,
): Promise<ServiceResult<{ feedback: AdminFeedback }>> {
  const existing = await findFeedbackById(id)
  if (!existing) return serviceError(ErrorCode.FEEDBACK_NOT_FOUND)

  if (existing.status === status) {
    logger.info({ adminId, action: AdminAction.UPDATE_FEEDBACK, feedbackId: id, changes: {} })
    return { data: { feedback: toAdminFeedback(existing) }, httpStatus: HttpStatus.OK }
  }

  const updated = await updateFeedbackStatus(id, status)
  if (!updated) return serviceError(ErrorCode.INTERNAL_ERROR)

  logger.info({
    adminId,
    action: AdminAction.UPDATE_FEEDBACK,
    feedbackId: id,
    changes: { status: { from: existing.status, to: status } },
  })

  return {
    data: { feedback: toAdminFeedback({ ...updated, user: existing.user }) },
    httpStatus: HttpStatus.OK,
  }
}
