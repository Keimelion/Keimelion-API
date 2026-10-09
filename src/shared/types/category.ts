import type { Category } from '../../db/entities/categories/categories.schema.js'

export interface CategoryPublic {
  id: string
  parentId: string | null
  name: string
  slug: string
  depth: number
}

export interface CategoryDetail extends CategoryPublic {
  createdAt: Date
  updatedAt: Date
}

export interface CategoryTreeNode extends CategoryPublic {
  children: CategoryTreeNode[]
}

export function toCategoryPublic(row: Category): CategoryPublic {
  return {
    id: row.id,
    parentId: row.parentId ?? null,
    name: row.name,
    slug: row.slug,
    depth: row.depth,
  }
}

export function toCategoryDetail(row: Category): CategoryDetail {
  return {
    ...toCategoryPublic(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
