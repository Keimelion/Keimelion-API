import type { db as Db } from '../../client.js'
import { ListUserRoles } from '../../../shared/enums/list-user-role.js'
import type { ListUserRole } from '../../../shared/enums/list-user-role.js'
import { LIST_IDS } from '../lists/lists.fixture.js'
import { listUsers } from './list-users.schema.js'

interface ListUserFixture {
  id: string
  listId: string
  ownerEmail: string
  role: ListUserRole
}

const LIST_USER_FIXTURES: readonly ListUserFixture[] = [
  {
    id: '7d3f0b40-0002-4b60-8000-000000000001',
    listId: LIST_IDS.BIRTHDAY,
    ownerEmail: 'user@example.com',
    role: ListUserRoles.OWNER,
  },
  {
    id: '7d3f0b40-0002-4b60-8000-000000000002',
    listId: LIST_IDS.HOUSEWARMING,
    ownerEmail: 'user@example.com',
    role: ListUserRoles.OWNER,
  },
  {
    id: '7d3f0b40-0002-4b60-8000-000000000003',
    listId: LIST_IDS.WEDDING,
    ownerEmail: 'moderator@example.com',
    role: ListUserRoles.OWNER,
  },
  {
    id: '7d3f0b40-0002-4b60-8000-000000000004',
    listId: LIST_IDS.WEDDING,
    ownerEmail: 'user@example.com',
    role: ListUserRoles.EDITOR,
  },
  {
    id: '7d3f0b40-0002-4b60-8000-000000000005',
    listId: LIST_IDS.SOFT_DELETED,
    ownerEmail: 'user@example.com',
    role: ListUserRoles.OWNER,
  },
]

export async function seedListUsers(db: typeof Db): Promise<void> {
  const userRows = await db.query.users.findMany({ columns: { id: true, email: true } })
  const userIdByEmail = new Map(userRows.map((row) => [row.email, row.id]))

  const values = LIST_USER_FIXTURES.flatMap((fixture) => {
    const userId = userIdByEmail.get(fixture.ownerEmail)
    if (!userId) return []
    return [
      {
        id: fixture.id,
        listId: fixture.listId,
        userId,
        role: fixture.role,
      },
    ]
  })

  if (values.length === 0) {
    console.log(`  list_users       0 rows`)
    return
  }

  const inserted = await db
    .insert(listUsers)
    .values(values)
    .onConflictDoNothing({ target: listUsers.id })
    .returning({ id: listUsers.id })

  console.log(`  list_users       ${String(inserted.length)} rows`)
}
