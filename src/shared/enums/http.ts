export const HttpMethod = {
  GET:     'GET',
  POST:    'POST',
  PUT:     'PUT',
  PATCH:   'PATCH',
  DELETE:  'DELETE',
  OPTIONS: 'OPTIONS',
} as const
export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod]

export const HttpHeader = {
  CONTENT_TYPE:  'Content-Type',
  AUTHORIZATION: 'Authorization',
} as const
export type HttpHeader = (typeof HttpHeader)[keyof typeof HttpHeader]

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const
export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus]
