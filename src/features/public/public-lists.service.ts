import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { findListBySlug } from '../../db/entities/lists/lists.repository.js'
import { serviceError } from '../../shared/utils/response.js'
import { toPublicListDetail } from '../../shared/types/list.js'
import type { Locale } from '../../shared/enums/locale.js'
import type { PublicListDetail } from '../../shared/types/list.js'
import type { ServiceResult } from '../../shared/types/service.js'

export async function getPublicListBySlug(
  slug: string,
  locale: Locale,
): Promise<ServiceResult<{ list: PublicListDetail }>> {
  const row = await findListBySlug(slug, { excludeDeleted: true })
  if (!row) return serviceError(ErrorCode.NOT_FOUND)
  return {
    data: { list: toPublicListDetail(row, locale) },
    httpStatus: HttpStatus.OK,
  }
}
