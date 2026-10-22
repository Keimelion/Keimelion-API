import type { db as Db } from '../../client.js'
import { ListStatuses } from '../../../shared/enums/list-status.js'
import { lists } from './lists.schema.js'

/**
 * Deterministic UUIDs for dev-seeded lists. `lists` has no natural key, so these
 * ids give us idempotent upserts across repeated `npm run db:seed` runs and let
 * downstream fixtures (collaborators, items, list_items, list_tags) look lists
 * up by a stable id.
 */
export const LIST_IDS = {
  BIRTHDAY: '7d3f0b40-0001-4b60-8000-000000000001',
  HOUSEWARMING: '7d3f0b40-0001-4b60-8000-000000000002',
  WEDDING: '7d3f0b40-0001-4b60-8000-000000000003',
  SOFT_DELETED: '7d3f0b40-0001-4b60-8000-000000000004',
} as const

interface ListFixture {
  id: string
  title: string
  slug: string
  description: string | null
  occasionSlug: string | null
  deletedAt: Date | null
}

const LIST_FIXTURES: readonly ListFixture[] = [
  {
    id: LIST_IDS.BIRTHDAY,
    title: 'Mon anniversaire',
    slug: 'mon-anniversaire-dev01',
    description: 'Mes envies pour mon anniversaire.',
    occasionSlug: 'birthday',
    deletedAt: null,
  },
  {
    id: LIST_IDS.HOUSEWARMING,
    title: 'Crémaillère',
    slug: 'cremaillere-dev01',
    description: 'Pour la pendaison de crémaillère.',
    occasionSlug: 'first-apartment',
    deletedAt: null,
  },
  {
    id: LIST_IDS.WEDDING,
    title: 'Liste de mariage',
    slug: 'liste-de-mariage-dev01',
    description: 'Notre liste de mariage — merci pour votre présence !',
    occasionSlug: 'wedding',
    deletedAt: null,
  },
  {
    id: LIST_IDS.SOFT_DELETED,
    title: 'Ancienne liste',
    slug: 'ancienne-liste-dev01',
    description: 'Soft-deleted dev list — useful for RGPD export testing.',
    occasionSlug: null,
    deletedAt: new Date('2026-02-01T00:00:00Z'),
  },
]

export async function seedLists(db: typeof Db): Promise<void> {
  const occasionRows = await db.query.occasionTypes.findMany({
    columns: { id: true, slug: true },
  })
  const occasionIdBySlug = new Map(occasionRows.map((row) => [row.slug, row.id]))

  const values = LIST_FIXTURES.map((fixture) => ({
    id: fixture.id,
    title: fixture.title,
    slug: fixture.slug,
    description: fixture.description,
    occasionTypeId:
      fixture.occasionSlug !== null ? occasionIdBySlug.get(fixture.occasionSlug) ?? null : null,
    listStatus: ListStatuses.ACTIVE,
    deletedAt: fixture.deletedAt,
  }))

  const inserted = await db
    .insert(lists)
    .values(values)
    .onConflictDoNothing({ target: lists.id })
    .returning({ id: lists.id })

  console.log(`  lists            ${String(inserted.length)} rows`)
}
