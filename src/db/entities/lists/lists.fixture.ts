import type { db as Db } from '../../client.js'
import { type ListStatus, ListStatuses } from '../../../shared/enums/list-status.js'
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
  ARCHIVED: '7d3f0b40-0001-4b60-8000-000000000005',
  STATUS_DELETED: '7d3f0b40-0001-4b60-8000-000000000006',
} as const

interface ListFixture {
  id: string
  title: string
  slug: string
  description: string | null
  occasionSlug: string | null
  listStatus: ListStatus
  deletedAt: Date | null
}

const LIST_FIXTURES: readonly ListFixture[] = [
  {
    id: LIST_IDS.BIRTHDAY,
    title: 'Mon anniversaire',
    slug: 'mon-anniversaire-dev01',
    description: 'Mes envies pour mon anniversaire.',
    occasionSlug: 'birthday',
    listStatus: ListStatuses.ACTIVE,
    deletedAt: null,
  },
  {
    id: LIST_IDS.HOUSEWARMING,
    title: 'Crémaillère',
    slug: 'cremaillere-dev01',
    description: 'Pour la pendaison de crémaillère.',
    occasionSlug: 'first-apartment',
    listStatus: ListStatuses.ACTIVE,
    deletedAt: null,
  },
  {
    id: LIST_IDS.WEDDING,
    title: 'Liste de mariage',
    slug: 'liste-de-mariage-dev01',
    description: 'Notre liste de mariage — merci pour votre présence !',
    occasionSlug: 'wedding',
    listStatus: ListStatuses.ACTIVE,
    deletedAt: null,
  },
  {
    id: LIST_IDS.SOFT_DELETED,
    title: 'Ancienne liste',
    slug: 'ancienne-liste-dev01',
    description: 'Soft-deleted dev list — useful for RGPD export testing.',
    occasionSlug: null,
    listStatus: ListStatuses.ACTIVE,
    deletedAt: new Date('2026-02-01T00:00:00Z'),
  },
  {
    id: LIST_IDS.ARCHIVED,
    title: 'Noël 2024',
    slug: 'noel-2024-dev01',
    description: 'Archived dev list — covers the list_status = archived admin filter.',
    occasionSlug: null,
    listStatus: ListStatuses.ARCHIVED,
    deletedAt: null,
  },
  {
    id: LIST_IDS.STATUS_DELETED,
    title: 'Liste supprimée',
    slug: 'liste-supprimee-dev01',
    description: 'list_status = deleted dev list — covers the hard-tombstoned admin case.',
    occasionSlug: null,
    listStatus: ListStatuses.DELETED,
    deletedAt: new Date('2026-03-15T00:00:00Z'),
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
    listStatus: fixture.listStatus,
    deletedAt: fixture.deletedAt,
  }))

  const inserted = await db
    .insert(lists)
    .values(values)
    .onConflictDoNothing({ target: lists.id })
    .returning({ id: lists.id })

  console.log(`  lists            ${String(inserted.length)} rows`)
}
