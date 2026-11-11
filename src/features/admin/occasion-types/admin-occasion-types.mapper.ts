import type { OccasionTypeRowWithTranslations } from '../../../shared/types/occasion-type.js'
import { toOccasionTypeDetail } from '../../../shared/types/occasion-type.js'
import type { AdminOccasionTypeDetailParsed } from '@keimelion/sdk/schemas'

export type AdminOccasionType = AdminOccasionTypeDetailParsed

export function toAdminOccasionType(row: OccasionTypeRowWithTranslations): AdminOccasionType {
  return {
    ...toOccasionTypeDetail(row),
    translations: row.translations.map((translation) => ({
      locale: translation.locale,
      label: translation.label,
    })),
  }
}
