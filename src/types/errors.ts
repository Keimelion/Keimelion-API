import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { HttpStatus } from './http.js'

export const ErrorCode = {
  BAD_REQUEST:          'BAD_REQUEST',
  UNAUTHORIZED:         'UNAUTHORIZED',
  FORBIDDEN:            'FORBIDDEN',
  NOT_FOUND:            'NOT_FOUND',
  CONFLICT:             'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  RATE_LIMIT_EXCEEDED:  'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR:       'INTERNAL_ERROR',
} as const
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export const errorMap: Record<ErrorCode, { status: ContentfulStatusCode; message: string }> = {
  BAD_REQUEST:          { status: HttpStatus.BAD_REQUEST,           message: 'Bad request' },
  UNAUTHORIZED:         { status: HttpStatus.UNAUTHORIZED,          message: 'Unauthorized' },
  FORBIDDEN:            { status: HttpStatus.FORBIDDEN,             message: 'Forbidden' },
  NOT_FOUND:            { status: HttpStatus.NOT_FOUND,             message: 'Resource not found' },
  CONFLICT:             { status: HttpStatus.CONFLICT,              message: 'Resource already exists' },
  UNPROCESSABLE_ENTITY: { status: HttpStatus.UNPROCESSABLE_ENTITY,  message: 'Validation failed' },
  RATE_LIMIT_EXCEEDED:  { status: HttpStatus.TOO_MANY_REQUESTS,     message: 'Too many requests' },
  INTERNAL_ERROR:       { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'An unexpected error occurred' },
}

