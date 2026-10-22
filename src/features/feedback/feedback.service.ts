import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { serviceError } from '../../shared/utils/response.js'
import { insertFeedback } from './feedback.repository.js'
import { toFeedbackDetail } from '../../shared/types/feedback.js'
import type { FeedbackDetail } from '../../shared/types/feedback.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { CreateFeedbackInput } from './endpoints/create.js'

export async function createFeedback(
  userId: string | null,
  input: CreateFeedbackInput,
): Promise<ServiceResult<{ feedback: FeedbackDetail }>> {
  const row = await insertFeedback({
    userId,
    title: input.title,
    description: input.description,
    context: input.context ?? null,
  })
  if (!row) return serviceError(ErrorCode.FEEDBACK_CREATION_FAILED)

  return {
    data: { feedback: toFeedbackDetail(row) },
    httpStatus: HttpStatus.CREATED,
  }
}
