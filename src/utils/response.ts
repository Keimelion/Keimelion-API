import { type ErrorCode, errorMap } from '../types/errors.js'
import type { ApiError } from '../types/api.js'

export function sendError(code: ErrorCode, metadata: Record<string, unknown> = {}): Response {
  const { status, message } = errorMap[code]
  const body: ApiError = { message, code, metadata }
  return Response.json(body, { status })
}
