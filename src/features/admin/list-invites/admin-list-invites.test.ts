import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../../db/client.js'
import { apiRequest } from '../../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../../shared/test/auth.js'
import { ADMIN_USER_FIXTURE as ADMIN_USER, makeAdminUser } from '../../../shared/test/fixtures/users.js'
import {
  adminCollaboratorInvitesListResponseSchema,
} from '@keimelion/sdk/schemas'

const NON_ADMIN_USER = makeAdminUser({
  id: '00000000-0000-0000-0000-000000000002',
  email: 'user@example.com',
  role: 'user',
})

const ADMIN_ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(ADMIN_USER.id)
const NON_ADMIN_ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(NON_ADMIN_USER.id)

const LIST_ID = '00000000-0000-0000-0000-00000000a010'
const INVITE_ID = '00000000-0000-0000-0000-00000000d001'

const INVITE_LIST = {
  id: LIST_ID,
  occasionTypeId: null,
  title: 'Birthday',
  slug: 'birthday-abc',
  description: null,
  listStatus: 'active' as const,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const PENDING_INVITE_ROW = {
  id: INVITE_ID,
  listId: LIST_ID,
  invitedByUserId: ADMIN_USER.id,
  invitedEmail: 'invitee@example.com',
  role: 'editor' as const,
  inviteToken: 'a'.repeat(64),
  inviteTokenExpiresAt: new Date(Date.now() + 60_000),
  inviteStatus: 'pending' as const,
  acceptedAt: null,
  acceptedByUserId: null,
  createdAt: new Date('2024-02-01'),
  updatedAt: new Date('2024-02-01'),
  invitedByUser: null,
  acceptedByUser: null,
  list: INVITE_LIST,
}

const EXPIRED_INVITE_ROW = {
  ...PENDING_INVITE_ROW,
  id: '00000000-0000-0000-0000-00000000d002',
  inviteTokenExpiresAt: new Date(Date.now() - 60_000),
}

function mockAdminAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ADMIN_ACCESS_TOKEN_ENTRY)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
}

function mockNonAdminAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(NON_ADMIN_ACCESS_TOKEN_ENTRY)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(NON_ADMIN_USER)
}

function mockCountChain(total: number): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ count: total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

describe('GET /v1/admin/collaborator-invites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with paginated editor invites and derived isExpired flag', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    vi.mocked(db.query.listInvites.findMany).mockResolvedValueOnce([
      PENDING_INVITE_ROW,
      EXPIRED_INVITE_ROW,
    ] as never)
    mockCountChain(2)

    const response = await apiRequest('/v1/admin/collaborator-invites', { token })

    const body = await response.json() as {
      items: {
        id: string
        role: string
        inviteStatus: string
        isExpired: boolean
        list: { id: string; title: string; slug: string }
      }[]
      pagination: { total: number }
    }
    adminCollaboratorInvitesListResponseSchema.parse(body)
    expect(response.status).toBe(200)
    expect(body.pagination.total).toBe(2)
    expect(body.items).toHaveLength(2)
    expect(body.items[0]?.role).toBe('editor')
    expect(body.items[0]?.list.id).toBe(LIST_ID)
    expect(body.items[0]?.isExpired).toBe(false)
    expect(body.items[1]?.isExpired).toBe(true)
    const bodyText = JSON.stringify(body)
    expect(bodyText).not.toContain('inviteToken')
    expect(bodyText).not.toContain('inviteTokenExpiresAt')
  })

  it('passes inviteStatus filter through to the repository', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    vi.mocked(db.query.listInvites.findMany).mockResolvedValueOnce([PENDING_INVITE_ROW] as never)
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/collaborator-invites?inviteStatus=pending', { token })

    expect(response.status).toBe(200)
    const findManyArgs = vi.mocked(db.query.listInvites.findMany).mock.calls[0]?.[0]
    expect(findManyArgs?.limit).toBe(20)
    expect(findManyArgs?.offset).toBe(0)
  })

  it('returns 422 when inviteStatus is not an allowed value', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/collaborator-invites?inviteStatus=bogus', { token })
    expect(response.status).toBe(422)
  })

  it('returns 403 when caller is not an admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/collaborator-invites', { token })
    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/admin/collaborator-invites')
    expect(response.status).toBe(401)
  })
})
