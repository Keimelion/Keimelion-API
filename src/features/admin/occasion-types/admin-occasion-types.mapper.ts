import type {
  OccasionTypeDetail,
  OccasionTypeRowWithTranslations,
} from '../../../shared/types/occasion-type.js'
import { toOccasionTypeDetail } from '../../../shared/types/occasion-type.js'

export interface AdminOccasionTypeTranslation {
  locale: string
  label: string
}

export interface AdminOccasionType extends OccasionTypeDetail {
  translations: AdminOccasionTypeTranslation[]
}

export function toAdminOccasionType(row: OccasionTypeRowWithTranslations): AdminOccasionType {
  return {
    ...toOccasionTypeDetail(row),
    translations: row.translations.map((translation) => ({
      locale: translation.locale,
      label: translation.label,
    })),
  }
}
