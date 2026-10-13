import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../client.js'
import { DEFAULT_LOCALE } from '../../../shared/enums/locale.js'
import { categories, categoryTranslations } from './categories.schema.js'
import type { Locale } from '../../../shared/enums/locale.js'
import type { Category, CategoryTranslation } from './categories.schema.js'
import type {
  CategoryRowWithResolvedName,
  CategoryRowWithTranslations,
} from '../../../shared/types/category.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbClient = typeof db | DbTransaction

interface CategoryWriteFields {
  parentId: string | null
  slug: string
  depth: number
}

type InsertCategoryFields = CategoryWriteFields
type UpdateCategoryFields = Partial<CategoryWriteFields>

const CATEGORY_WITH_TRANSLATIONS = { translations: true } as const

export async function findCategoryById(
  id: string,
  client: DbClient = db,
): Promise<Category | undefined> {
  return client.query.categories.findFirst({ where: eq(categories.id, id) })
}

export function findCategoryByIdWithTranslations(
  id: string,
): Promise<CategoryRowWithTranslations | undefined> {
  return db.query.categories.findFirst({
    where: eq(categories.id, id),
    with: CATEGORY_WITH_TRANSLATIONS,
  })
}

export function findAllCategoriesOrdered(
  locale: Locale,
): Promise<CategoryRowWithResolvedName[]> {
  return db
    .select({
      id: categories.id,
      parentId: categories.parentId,
      slug: categories.slug,
      depth: categories.depth,
      name: sql<string>`COALESCE(t.name, t_fallback.name)`,
    })
    .from(categories)
    .leftJoin(
      sql`${categoryTranslations} AS t`,
      and(eq(sql`t.category_id`, categories.id), eq(sql`t.locale`, locale)),
    )
    .leftJoin(
      sql`${categoryTranslations} AS t_fallback`,
      and(
        eq(sql`t_fallback.category_id`, categories.id),
        eq(sql`t_fallback.locale`, DEFAULT_LOCALE),
      ),
    )
    .orderBy(asc(categories.depth))
}

export async function findCategoriesByIds(ids: string[]): Promise<Category[]> {
  if (ids.length === 0) return []
  return db.query.categories.findMany({ where: inArray(categories.id, ids) })
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

export async function upsertCategoryTranslation(
  categoryId: string,
  locale: CategoryTranslation['locale'],
  name: string,
  client: DbClient = db,
): Promise<void> {
  await client
    .insert(categoryTranslations)
    .values({ categoryId, locale, name })
    .onConflictDoUpdate({
      target: [categoryTranslations.categoryId, categoryTranslations.locale],
      set: { name },
    })
}

export async function deleteCategory(id: string): Promise<Category | undefined> {
  const [row] = await db.delete(categories).where(eq(categories.id, id)).returning()
  return row
}
