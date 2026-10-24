import type { db as Db } from '../../client.js'
import { reservations } from './reservations.schema.js'

interface ReservationFixture {
  id: string
  listItemId: string
  reserverEmail: string
  quantityBooked: number
}

/**
 * Reservations are scoped by (list_item_id, user_id) with a UNIQUE constraint —
 * one booking per (user, item). Users book items on lists owned by OTHER users
 * (never on their own list in the real flow); fixtures reflect that: the
 * reserver is distinct from the list owner. Items picked here belong to the
 * wedding list (owned by moderator@example.com) so user@example.com and
 * google.user@gmail.com can book them.
 */
const RESERVATION_FIXTURES: readonly ReservationFixture[] = [
  {
    id: '7d3f0b40-0007-4b60-8000-000000000001',
    listItemId: '7d3f0b40-0005-4b60-8000-000000000007', // Wedding — dishes
    reserverEmail: 'user@example.com',
    quantityBooked: 1,
  },
  {
    id: '7d3f0b40-0007-4b60-8000-000000000002',
    listItemId: '7d3f0b40-0005-4b60-8000-000000000009', // Wedding — vase (qty 3)
    reserverEmail: 'user@example.com',
    quantityBooked: 2,
  },
  {
    id: '7d3f0b40-0007-4b60-8000-000000000003',
    listItemId: '7d3f0b40-0005-4b60-8000-00000000000b', // Wedding — stand mixer
    reserverEmail: 'google.user@gmail.com',
    quantityBooked: 1,
  },
]

export async function seedReservations(db: typeof Db): Promise<void> {
  const userRows = await db.query.users.findMany({ columns: { id: true, email: true } })
  const userIdByEmail = new Map(userRows.map((row) => [row.email, row.id]))

  const values = RESERVATION_FIXTURES.flatMap((fixture) => {
    const userId = userIdByEmail.get(fixture.reserverEmail)
    if (!userId) return []
    return [
      {
        id: fixture.id,
        listItemId: fixture.listItemId,
        userId,
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

  console.log(`  reservations     ${String(inserted.length)} rows`)
}
