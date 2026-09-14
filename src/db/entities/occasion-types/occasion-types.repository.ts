import { and, asc, count, eq, sql } from 'drizzle-orm'
import { db } from '../../client.js'
import { occasionTypes, occasionTypeTranslations } from './occasion-types.schema.js'
import { DEFAULT_LOCALE } from '../../../shared/enums/locale.js'
import type { Locale } from '../../../shared/enums/locale.js'
import type { OccasionType, OccasionTypeTranslation } from './occasion-types.schema.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

type InsertOccasionTypeFields = Omit<typeof occasionTypes.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>

interface InsertTranslationFields { locale: OccasionTypeTranslation['locale']; label: string }

type UpdateOccasionTypeFields = Partial<
  Pick<typeof occasionTypes.$inferInsert, 'emoji' | 'sortOrder' | 'isActive'>
>

export interface OccasionTypeWithLabel {
  id: string
  slug: string
  label: string
  emoji: string | null
  sortOrder: number
  isActive: boolean
}

export function listActiveOccasionTypes(locale: Locale): Promise<OccasionTypeWithLabel[]> {
  return db
    .select({
      id: occasionTypes.id,
      slug: occasionTypes.slug,
      label: sql<string>`COALESCE(t.label, t_fallback.label)`,
      emoji: occasionTypes.emoji,
      sortOrder: occasionTypes.sortOrder,
      isActive: occasionTypes.isActive,
    })
    .from(occasionTypes)
    .leftJoin(
      sql`${occasionTypeTranslations} AS t`,
      and(
        eq(sql`t.occasion_type_id`, occasionTypes.id),
        eq(sql`t.locale`, locale),
      ),
    )
    .leftJoin(
      sql`${occasionTypeTranslations} AS t_fallback`,
      and(
        eq(sql`t_fallback.occasion_type_id`, occasionTypes.id),
        eq(sql`t_fallback.locale`, DEFAULT_LOCALE),
      ),
    )
    .where(eq(occasionTypes.isActive, true))
    .orderBy(asc(occasionTypes.sortOrder))
}

export async function findOccasionTypeById(id: string): Promise<OccasionType | undefined> {
  return db.query.occasionTypes.findFirst({ where: eq(occasionTypes.id, id) })
}

export function findAllOccasionTypes(input: PaginationInput): Promise<OccasionType[]> {
  const offset = (input.page - 1) * input.limit
  return db.query.occasionTypes.findMany({
    orderBy: asc(occasionTypes.sortOrder),
    limit: input.limit,
    offset,
  })
}

export async function countOccasionTypes(): Promise<number> {
  const [row] = await db.select({ count: count() }).from(occasionTypes)
  return row?.count ?? 0
}

export async function findTranslationsForOccasionType(
  occasionTypeId: string,
): Promise<OccasionTypeTranslation[]> {
  return db.query.occasionTypeTranslations.findMany({
    where: eq(occasionTypeTranslations.occasionTypeId, occasionTypeId),
  })
}

export async function insertOccasionType(
  fields: InsertOccasionTypeFields,
  translations: InsertTranslationFields[],
): Promise<OccasionType | undefined> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(occasionTypes).values(fields).returning()
    if (!row) return undefined
    await tx.insert(occasionTypeTranslations).values(
      translations.map((translation) => ({ occasionTypeId: row.id, ...translation })),
    )
    return row
  })
}

export async function updateOccasionType(
  id: string,
  fields: UpdateOccasionTypeFields,
  tx?: DbTransaction,
): Promise<OccasionType | undefined> {
  const [row] = await (tx ?? db)
    .update(occasionTypes)
    .set(fields)
    .where(eq(occasionTypes.id, id))
    .returning()
  return row
}

export async function upsertOccasionTypeTranslation(
  occasionTypeId: string,
  locale: OccasionTypeTranslation['locale'],
  label: string,
  tx?: DbTransaction,
): Promise<void> {
  await (tx ?? db)
    .insert(occasionTypeTranslations)
    .values({ occasionTypeId, locale, label })
    .onConflictDoUpdate({
      target: [occasionTypeTranslations.occasionTypeId, occasionTypeTranslations.locale],
      set: { label },
    })
}

export async function deleteOccasionTypeTranslation(
  occasionTypeId: string,
  locale: OccasionTypeTranslation['locale'],
  tx?: DbTransaction,
): Promise<void> {
  await (tx ?? db)
    .delete(occasionTypeTranslations)
    .where(
      and(
        eq(occasionTypeTranslations.occasionTypeId, occasionTypeId),
        eq(occasionTypeTranslations.locale, locale),
      ),
    )
}

export async function deleteOccasionType(id: string): Promise<OccasionType | undefined> {
  const [row] = await db.delete(occasionTypes).where(eq(occasionTypes.id, id)).returning()
  return row
}
