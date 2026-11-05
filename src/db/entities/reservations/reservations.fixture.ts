import { eq, inArray, sql } from 'drizzle-orm'
import type { db as Db } from '../../client.js'
import { listItems } from '../list-items/list-items.schema.js'
import { ItemStatuses } from '../../../shared/enums/item-status.js'
import { hashSha256Hex } from '../../../shared/utils/hash.js'
import { reservations } from './reservations.schema.js'

interface ReservationFixture {
  id: string
  listItemId: string
  reserverUserEmail: string | null
  reserverName: string | null
  reserverEmail: string | null
  rawAnonymousToken: string | null
  quantityBooked: number
}

export const DEV_ANONYMOUS_RESERVATION_TOKEN = 'rsv_devAnonymousReservationToken000000000000000'

/**
 * Covers the three reservation modes on the wedding list (owned by moderator@example.com):
 * - authenticated: user_id set, one booking per (user, item) via the UNIQUE constraint;
 * - anonymous: reserver_name + anonymous_token_hash, managed with DEV_ANONYMOUS_RESERVATION_TOKEN;
 * - proxy: reserver_name only, created by the list owner on behalf of a guest.
 */
const RESERVATION_FIXTURES: readonly ReservationFixture[] = [
  {
    id: '7d3f0b40-0007-4b60-8000-000000000001',
    listItemId: '7d3f0b40-0005-4b60-8000-000000000007', // Wedding — dishes
    reserverUserEmail: 'user@example.com',
    reserverName: null,
    reserverEmail: null,
    rawAnonymousToken: null,
    quantityBooked: 1,
  },
  {
    id: '7d3f0b40-0007-4b60-8000-000000000002',
    listItemId: '7d3f0b40-0005-4b60-8000-000000000009', // Wedding — vase (qty 3)
    reserverUserEmail: 'user@example.com',
    reserverName: null,
    reserverEmail: null,
    rawAnonymousToken: null,
    quantityBooked: 2,
  },
  {
    id: '7d3f0b40-0007-4b60-8000-000000000003',
    listItemId: '7d3f0b40-0005-4b60-8000-00000000000b', // Wedding — stand mixer
    reserverUserEmail: 'google.user@gmail.com',
    reserverName: null,
    reserverEmail: null,
    rawAnonymousToken: null,
    quantityBooked: 1,
  },
  {
    id: '7d3f0b40-0007-4b60-8000-000000000004',
    listItemId: '7d3f0b40-0005-4b60-8000-000000000009', // Wedding — vase (qty 3)
    reserverUserEmail: null,
    reserverName: 'Aunt Marie',
    reserverEmail: 'aunt.marie@example.com',
    rawAnonymousToken: DEV_ANONYMOUS_RESERVATION_TOKEN,
    quantityBooked: 1,
  },
  {
    id: '7d3f0b40-0007-4b60-8000-000000000005',
    listItemId: '7d3f0b40-0005-4b60-8000-000000000008', // Wedding — linen
    reserverUserEmail: null,
    reserverName: 'Grandpa Joe',
    reserverEmail: null,
    rawAnonymousToken: null,
    quantityBooked: 1,
  },
]

export async function seedReservations(db: typeof Db): Promise<void> {
  const userRows = await db.query.users.findMany({ columns: { id: true, email: true } })
  const userIdByEmail = new Map(userRows.map((row) => [row.email, row.id]))

  const values = RESERVATION_FIXTURES.flatMap((fixture) => {
    const userId = fixture.reserverUserEmail === null ? null : userIdByEmail.get(fixture.reserverUserEmail)
    if (userId === undefined) return []
    return [
      {
        id: fixture.id,
        listItemId: fixture.listItemId,
        userId,
        reserverName: fixture.reserverName,
        reserverEmail: fixture.reserverEmail,
        anonymousTokenHash: fixture.rawAnonymousToken === null ? null : hashSha256Hex(fixture.rawAnonymousToken),
        quantityBooked: fixture.quantityBooked,
      },
    ]
  })

  if (values.length === 0) {
    console.log(`  reservations     0 rows`)
    return
  }

  const inserted = await db
    .insert(reservations)
    .values(values)
    .onConflictDoNothing({ target: reservations.id })
    .returning({ id: reservations.id })

  // Keep list_items.quantity_reserved_total and item_status consistent with the
  // seeded reservations so the invariant maintained by the reserve endpoint also
  // holds in dev fixtures.
  const affectedListItemIds = [...new Set(values.map((row) => row.listItemId))]
  if (affectedListItemIds.length > 0) {
    const totalsByListItem = new Map<string, number>()
    for (const value of values) {
      const previous = totalsByListItem.get(value.listItemId) ?? 0
      totalsByListItem.set(value.listItemId, previous + value.quantityBooked)
    }

    const rows = await db
      .select({ id: listItems.id, quantityDesired: listItems.quantityDesired })
      .from(listItems)
      .where(inArray(listItems.id, affectedListItemIds))

    for (const row of rows) {
      const reserved = totalsByListItem.get(row.id) ?? 0
      const nextStatus = reserved >= row.quantityDesired ? ItemStatuses.RESERVED : ItemStatuses.AVAILABLE
      await db
        .update(listItems)
        .set({ quantityReservedTotal: reserved, itemStatus: nextStatus, updatedAt: sql`now()` })
        .where(eq(listItems.id, row.id))
    }
  }

  console.log(`  reservations     ${String(inserted.length)} rows`)
}
