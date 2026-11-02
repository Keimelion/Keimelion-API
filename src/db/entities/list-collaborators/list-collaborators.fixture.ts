import type { db as Db } from '../../client.js'
import { CollabRoles } from '../../../shared/enums/collab-role.js'
import { InviteStatuses } from '../../../shared/enums/invite-status.js'
import { LIST_IDS } from '../lists/lists.fixture.js'
import { listCollaborators } from './list-collaborators.schema.js'

const OWNER_INVITE_STATUS = InviteStatuses.ACCEPTED

interface CollabFixture {
  id: string
  listId: string
  ownerEmail: string
  collabRole: (typeof CollabRoles)[keyof typeof CollabRoles]
  acceptedAt: Date
}

const COLLAB_FIXTURES: readonly CollabFixture[] = [
  {
    id: '7d3f0b40-0002-4b60-8000-000000000001',
    listId: LIST_IDS.BIRTHDAY,
    ownerEmail: 'user@example.com',
    collabRole: CollabRoles.OWNER,
    acceptedAt: new Date('2026-01-10T09:00:00Z'),
  },
  {
    id: '7d3f0b40-0002-4b60-8000-000000000002',
    listId: LIST_IDS.HOUSEWARMING,
    ownerEmail: 'user@example.com',
    collabRole: CollabRoles.OWNER,
    acceptedAt: new Date('2026-01-15T09:00:00Z'),
  },
  {
    id: '7d3f0b40-0002-4b60-8000-000000000003',
    listId: LIST_IDS.WEDDING,
    ownerEmail: 'moderator@example.com',
    collabRole: CollabRoles.OWNER,
    acceptedAt: new Date('2026-02-01T09:00:00Z'),
  },
  {
    id: '7d3f0b40-0002-4b60-8000-000000000004',
    listId: LIST_IDS.WEDDING,
    ownerEmail: 'user@example.com',
    collabRole: CollabRoles.EDITOR,
    acceptedAt: new Date('2026-02-05T10:00:00Z'),
  },
  {
    id: '7d3f0b40-0002-4b60-8000-000000000005',
    listId: LIST_IDS.SOFT_DELETED,
    ownerEmail: 'user@example.com',
    collabRole: CollabRoles.OWNER,
    acceptedAt: new Date('2025-10-01T09:00:00Z'),
  },
]

export async function seedListCollaborators(db: typeof Db): Promise<void> {
  const userRows = await db.query.users.findMany({ columns: { id: true, email: true } })
  const userIdByEmail = new Map(userRows.map((row) => [row.email, row.id]))

  const values = COLLAB_FIXTURES.flatMap((fixture) => {
    const userId = userIdByEmail.get(fixture.ownerEmail)
    if (!userId) return []
    return [
      {
        id: fixture.id,
        listId: fixture.listId,
        userId,
        collabRole: fixture.collabRole,
        inviteStatus: OWNER_INVITE_STATUS,
        acceptedAt: fixture.acceptedAt,
      },
    ]
  })

  if (values.length === 0) {
    console.log(`  list_collabs     0 rows`)
    return
  }

  const inserted = await db
    .insert(listCollaborators)
    .values(values)
    .onConflictDoNothing({ target: listCollaborators.id })
    .returning({ id: listCollaborators.id })

  console.log(`  list_collabs     ${String(inserted.length)} rows`)
}
