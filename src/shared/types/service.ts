import type { ApiErrorBodyParsed } from '@keimelion/sdk/schemas'

export interface ServiceResult<T> {
  data: T | ApiErrorBodyParsed
  httpStatus: number
}
