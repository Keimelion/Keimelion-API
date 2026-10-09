import { toCategoryPublic } from '../../shared/types/category.js'
import type { Category } from '../../db/entities/categories/categories.schema.js'
import type { CategoryTreeNode } from '../../shared/types/category.js'

export function buildCategoryTree(rows: Category[]): CategoryTreeNode[] {
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
