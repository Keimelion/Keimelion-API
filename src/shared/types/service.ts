import type { ApiError } from './api.js'

export interface ServiceResult<T> {
  data: T | ApiError
  httpStatus: number
}
