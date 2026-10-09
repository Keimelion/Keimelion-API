import { HttpStatus } from '../../shared/enums/http.js'
import { findAllCategoriesOrdered } from '../../db/entities/categories/categories.repository.js'
import { buildCategoryTree } from './categories.mapper.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { CategoryTreeNode } from '../../shared/types/category.js'

export async function listCategoryTree(): Promise<ServiceResult<{ categories: CategoryTreeNode[] }>> {
  const rows = await findAllCategoriesOrdered()
  return { data: { categories: buildCategoryTree(rows) }, httpStatus: HttpStatus.OK }
}
