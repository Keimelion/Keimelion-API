import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { ErrorCode } from '../enums/error-code.js'
import { HttpStatus } from '../enums/http.js'
import type { ApiError } from '../types/api.js'

const errorMap: Record<ErrorCode, { status: ContentfulStatusCode; message: string }> = {
  BAD_REQUEST:             { status: HttpStatus.BAD_REQUEST,           message: 'Bad request' },
  UNAUTHORIZED:            { status: HttpStatus.UNAUTHORIZED,          message: 'Unauthorized' },
  FORBIDDEN:               { status: HttpStatus.FORBIDDEN,             message: 'Forbidden' },
  EMAIL_NOT_VERIFIED:      { status: HttpStatus.FORBIDDEN,             message: 'Email address has not been verified' },
  ACCOUNT_BANNED:          { status: HttpStatus.FORBIDDEN,             message: 'This account has been suspended' },
  NOT_FOUND:               { status: HttpStatus.NOT_FOUND,             message: 'Resource not found' },
  CONFLICT:                { status: HttpStatus.CONFLICT,              message: 'Resource already exists' },
  UNPROCESSABLE_ENTITY:    { status: HttpStatus.UNPROCESSABLE_ENTITY,  message: 'Validation failed' },
  RATE_LIMIT_EXCEEDED:     { status: HttpStatus.TOO_MANY_REQUESTS,     message: 'Too many requests' },
  USER_CREATION_FAILED:    { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Account could not be created' },
  USER_UPDATE_FAILED:      { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Account could not be updated' },
  ACCOUNT_DELETION_FAILED: { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Account could not be deleted' },
  INTERNAL_ERROR:          { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'An unexpected error occurred' },
}

export function sendError(code: ErrorCode, metadata: Record<string, unknown> = {}): Response {
  const { status, message } = errorMap[code]
  const body: ApiError = { message, code, metadata }
  return Response.json(body, { status })
}

export function serviceError(code: ErrorCode, metadata: Record<string, unknown> = {}): { data: ApiError; httpStatus: number } {
  const { status, message } = errorMap[code]
  return { data: { message, code, metadata }, httpStatus: status }
}
