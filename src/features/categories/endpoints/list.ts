import { HttpStatus } from '../../../shared/enums/http.js'
import { findAllCategoriesOrdered } from '../../../db/entities/categories/categories.repository.js'
import { getLocale } from '../../../shared/middlewares/resolve-locale.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { toCategoryPublic } from '../../../shared/types/category.js'
import type {
  CategoryRowWithResolvedName,
  CategoryTreeNode,
} from '../../../shared/types/category.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import type { Locale } from '../../../shared/enums/locale.js'
import type { ServiceResult } from '../../../shared/types/service.js'

export function mountListCategories(router: FeatureRouter): void {
  router.get('/', async (context) => {
    const locale = getLocale(context)
    return jsonResult(context, await listCategoryTree(locale))
  })
}

async function listCategoryTree(
  locale: Locale,
): Promise<ServiceResult<{ categories: CategoryTreeNode[] }>> {
  const rows = await findAllCategoriesOrdered(locale)
  return { data: { categories: buildCategoryTree(rows) }, httpStatus: HttpStatus.OK }
}

function buildCategoryTree(rows: CategoryRowWithResolvedName[]): CategoryTreeNode[] {
  const nodesById = new Map<string, CategoryTreeNode>()
  for (const row of rows) {
    nodesById.set(row.id, { ...toCategoryPublic(row), children: [] })
  }

  const roots: CategoryTreeNode[] = []
  for (const row of rows) {
    const node = nodesById.get(row.id)
    if (!node) continue
    if (row.parentId === null) {
      roots.push(node)
      continue
    }
    const parent = nodesById.get(row.parentId)
    if (parent) {
      parent.children.push(node)
      continue
    }
    roots.push(node)
  }

  return sortTree(roots)
}

function sortTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  const sorted = [...nodes].sort((left, right) => left.name.localeCompare(right.name))
  for (const node of sorted) {
    node.children = sortTree(node.children)
  }
  return sorted
}
