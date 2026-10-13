import { asc } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { categories } from '../../../db/entities/categories/categories.schema.js'
import type { CategoryRowWithTranslations } from '../../../shared/types/category.js'

export function findAllCategoriesForAdmin(): Promise<CategoryRowWithTranslations[]> {
  return db.query.categories.findMany({
    orderBy: [asc(categories.depth), asc(categories.slug)],
    with: { translations: true },
  })
}
