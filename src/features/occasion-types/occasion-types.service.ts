import { HttpStatus } from '../../shared/enums/http.js'
import { listActiveOccasionTypes } from '../../db/entities/occasion-types/occasion-types.repository.js'
import { toPublicOccasionType } from './occasion-types.mapper.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { PublicOccasionType } from './occasion-types.mapper.js'
import type { Locale } from '../../shared/enums/locale.js'

export async function listOccasionTypes(locale: Locale): Promise<ServiceResult<PublicOccasionType[]>> {
  const rows = await listActiveOccasionTypes(locale)
  return {
    data: rows.map(toPublicOccasionType),
    httpStatus: HttpStatus.OK,
  }
}
