import { asc } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { categories } from '../../../db/entities/categories/categories.schema.js'
import type { Category } from '../../../db/entities/categories/categories.schema.js'

export function findAllCategories(): Promise<Category[]> {
  return db.query.categories.findMany({
    orderBy: [asc(categories.depth), asc(categories.name)],
  })
}
