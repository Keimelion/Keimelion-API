import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '../../client.js'
import { occasionTypes, occasionTypeTranslations } from './occasion-types.schema.js'
import { DEFAULT_LOCALE } from '../../../shared/enums/locale.js'
import type { Locale } from '../../../shared/enums/locale.js'

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
