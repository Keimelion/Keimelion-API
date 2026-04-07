import { ErrorCode } from '../enums/error-code.js'
import { sendError } from './response.js'

export function validationErrorHandler(result: { success: boolean }): Response | undefined {
  if (!result.success) {
    return sendError(ErrorCode.UNPROCESSABLE_ENTITY)
  }
  return undefined
}
