import type { db as Db } from '../../client.js'
import { createHash } from 'crypto'
import { InviteStatuses } from '../../../shared/enums/invite-status.js'
import { ListUserRoles } from '../../../shared/enums/list-user-role.js'
import { LIST_IDS } from '../lists/lists.fixture.js'
import { listInvites } from './list-invites.schema.js'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

interface ListInviteFixture {
  id: string
  listId: string
  inviterEmail: string
  invitedEmail: string
  rawToken: string
}

/**
 * Raw tokens are intentionally stable so a dev can accept them via curl.
 * They would never ship in production; the hash is what is stored.
 */
export const DEV_INVITE_TOKENS = {
  BIRTHDAY_PENDING:
    '0000000000000000000000000000000000000000000000000000000000000001',
}

const LIST_INVITE_FIXTURES: readonly ListInviteFixture[] = [
  {
    id: '7d3f0b40-0003-4b60-8000-000000000001',
    listId: LIST_IDS.BIRTHDAY,
    inviterEmail: 'user@example.com',
    invitedEmail: 'invitee.dev@example.com',
    rawToken: DEV_INVITE_TOKENS.BIRTHDAY_PENDING,
  },
]

export async function seedListInvites(db: typeof Db): Promise<void> {
  const userRows = await db.query.users.findMany({ columns: { id: true, email: true } })
  const userIdByEmail = new Map(userRows.map((row) => [row.email, row.id]))

  const now = new Date()
  const values = LIST_INVITE_FIXTURES.flatMap((fixture) => {
    const invitedByUserId = userIdByEmail.get(fixture.inviterEmail)
    if (!invitedByUserId) return []
    const tokenHash = createHash('sha256').update(fixture.rawToken).digest('hex')
    return [
      {
        id: fixture.id,
        listId: fixture.listId,
        invitedByUserId,
        invitedEmail: fixture.invitedEmail,
        role: ListUserRoles.EDITOR,
        inviteToken: tokenHash,
        inviteTokenExpiresAt: new Date(now.getTime() + SEVEN_DAYS_MS),
        inviteStatus: InviteStatuses.PENDING,
      },
    ]
  })

  if (values.length === 0) {
    console.log(`  list_invites     0 rows`)
    return
  }

  const inserted = await db
    .insert(listInvites)
    .values(values)
    .onConflictDoNothing({ target: listInvites.id })
    .returning({ id: listInvites.id })

  console.log(`  list_invites     ${String(inserted.length)} rows`)
}
