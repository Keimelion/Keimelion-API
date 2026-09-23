import type { OccasionType, OccasionTypeTranslation } from '../../../db/entities/occasion-types/occasion-types.schema.js'
import type { OccasionTypeDetail } from '../../../shared/types/occasion-type.js'
import { toOccasionTypeDetail } from '../../../shared/types/occasion-type.js'

export interface AdminOccasionTypeTranslation {
  locale: string
  label: string
}

export interface AdminOccasionType extends OccasionTypeDetail {
  translations: AdminOccasionTypeTranslation[]
}

export function toAdminOccasionType(
  row: OccasionType,
  translations: OccasionTypeTranslation[],
): AdminOccasionType {
  return {
    ...toOccasionTypeDetail(row),
    translations: translations.map((translation) => ({
      locale: translation.locale,
      label: translation.label,
    })),
  }
}
