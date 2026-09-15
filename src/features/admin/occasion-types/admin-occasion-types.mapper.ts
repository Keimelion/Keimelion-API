import type { OccasionType, OccasionTypeTranslation } from '../../../db/entities/occasion-types/occasion-types.schema.js'
import type { BaseOccasionType } from '../../../shared/types/occasion-type.js'
import { toBaseOccasionType } from '../../occasion-types/occasion-types.mapper.js'

export interface AdminOccasionTypeTranslation {
  locale: string
  label: string
}

export interface AdminOccasionType extends BaseOccasionType {
  translations: AdminOccasionTypeTranslation[]
}

export function toAdminOccasionType(
  row: OccasionType,
  translations: OccasionTypeTranslation[],
): AdminOccasionType {
  return {
    ...toBaseOccasionType(row),
    translations: translations.map((translation) => ({
      locale: translation.locale,
      label: translation.label,
    })),
  }
}
