import { toCategoryDetail } from '../../../shared/types/category.js'
import type { Category } from '../../../db/entities/categories/categories.schema.js'
import type { CategoryDetail } from '../../../shared/types/category.js'

export type AdminCategoryDetail = CategoryDetail

export function toAdminCategoryDetail(row: Category): AdminCategoryDetail {
  return toCategoryDetail(row)
}
