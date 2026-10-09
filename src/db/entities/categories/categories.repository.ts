import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '../../client.js'
import { categories } from './categories.schema.js'
import type { Category } from './categories.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbClient = typeof db | DbTransaction

interface CategoryWriteFields {
  parentId: string | null
  name: string
  slug: string
  depth: number
}

type InsertCategoryFields = CategoryWriteFields
type UpdateCategoryFields = Partial<CategoryWriteFields>

export async function findCategoryById(id: string, client: DbClient = db): Promise<Category | undefined> {
  return client.query.categories.findFirst({ where: eq(categories.id, id) })
}

export async function findCategoryBySlug(slug: string): Promise<Category | undefined> {
  return db.query.categories.findFirst({ where: eq(categories.slug, slug) })
}

export async function findAllCategoriesOrdered(): Promise<Category[]> {
  return db.query.categories.findMany({
    orderBy: [asc(categories.depth), asc(categories.name)],
  })
}

export async function findCategoriesByIds(ids: string[]): Promise<Category[]> {
  if (ids.length === 0) return []
  return db.query.categories.findMany({ where: inArray(categories.id, ids) })
}

export async function findCategoriesByParentId(
  parentId: string,
  client: DbClient = db,
): Promise<Category[]> {
  return client.query.categories.findMany({ where: eq(categories.parentId, parentId) })
}

export async function findCategoriesByParentIds(
  parentIds: string[],
  client: DbClient = db,
): Promise<Category[]> {
  if (parentIds.length === 0) return []
  return client.query.categories.findMany({
    where: inArray(categories.parentId, parentIds),
  })
}

export async function insertCategory(
  fields: InsertCategoryFields,
  client: DbClient = db,
): Promise<Category | undefined> {
  const [row] = await client.insert(categories).values(fields).returning()
  return row
}

export async function updateCategoryRow(
  id: string,
  fields: UpdateCategoryFields,
  client: DbClient = db,
): Promise<Category | undefined> {
  const [row] = await client.update(categories).set(fields).where(eq(categories.id, id)).returning()
  return row
}

export async function updateCategoryDepth(
  id: string,
  depth: number,
  client: DbClient = db,
): Promise<void> {
  await client.update(categories).set({ depth }).where(eq(categories.id, id))
}

export async function deleteCategory(id: string): Promise<Category | undefined> {
  const [row] = await db.delete(categories).where(eq(categories.id, id)).returning()
  return row
}
