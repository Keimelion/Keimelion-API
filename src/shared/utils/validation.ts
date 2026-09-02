import type { Context } from 'hono'
import { ErrorCode } from '../enums/error-code.js'
import { errorMap } from './response.js'

export function validationErrorHandler(result: { success: boolean }, c: Context): Response | undefined {
  if (!result.success) {
    const { status, message } = errorMap[ErrorCode.UNPROCESSABLE_ENTITY]
    return c.json({ message, code: ErrorCode.UNPROCESSABLE_ENTITY, metadata: {} }, status)
  }
  return undefined
}
