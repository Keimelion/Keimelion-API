import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { REPORT_DESCRIPTION_MAX_LENGTH, reportsCreateResponseSchema } from '@keimelion/sdk/schemas'
import { db } from '../../db/client.js'
import { reports } from '../../db/entities/reports/reports.schema.js'
import { apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'
import { makeAdminUser } from '../../shared/test/fixtures/users.js'
import type { Image } from '../../db/entities/images/images.schema.js'
import type { Report } from '../../db/entities/reports/reports.schema.js'

const REPORTER = makeAdminUser({
  id: '00000000-0000-0000-0000-000000000100',
  email: 'reporter@example.com',
  username: 'reporter',
  role: 'user',
})

const TARGET_USER_ID = '00000000-0000-0000-0000-000000000200'
const LIST_ID = '00000000-0000-0000-0000-000000000300'
const ITEM_ID = '00000000-0000-0000-0000-000000000400'
const IMAGE_ID = '00000000-0000-0000-0000-000000000500'
const REPORT_ID = '00000000-0000-0000-0000-000000000600'

const SENSITIVE_SNAPSHOT_KEYS = [
  'email',
  'passwordHash',
  'emailVerifyToken',
  'passwordResetToken',
  'refreshToken',
  'accessToken',
  'banReason',
  'fileKey',
]

const IMAGE: Image = {
  id: IMAGE_ID,
  hash: 'a'.repeat(64),
  fileKey: 'internal/file-key',
  mime: 'image/webp',
  sizeBytes: 1024,
  width: 300,
  height: 200,
  uploadedBy: TARGET_USER_ID,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const TARGET_USER = makeAdminUser({
  id: TARGET_USER_ID,
  email: 'target@example.com',
  username: 'target',
  role: 'user',
  passwordHash: 'secret-hash',
  emailVerifyToken: 'verify-token',
  passwordResetToken: 'reset-token',
  avatarImageId: IMAGE_ID,
})

function buildReportRow(overrides: Partial<Report> = {}): Report {
  return {
    id: REPORT_ID,
    userId: REPORTER.id,
    targetType: 'user',
    targetId: TARGET_USER_ID,
    targetSnapshot: {},
    targetImageId: null,
    reason: 'harassment',
    description: null,
    reportStatus: 'pending',
    adminNote: null,
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
    ...overrides,
  }
}

function buildListRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: LIST_ID,
    title: 'Birthday',
    slug: 'birthday-abc123',
    description: null,
    listStatus: 'archived',
    occasionTypeId: null,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    listUsers: [
      {
        id: '00000000-0000-0000-0000-000000000301',
        listId: LIST_ID,
        userId: TARGET_USER_ID,
        role: 'owner',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        user: { ...TARGET_USER, avatarImage: IMAGE },
      },
    ],
    listTags: [],
    ...overrides,
  }
}

function buildItemRow(): Record<string, unknown> {
  return {
    id: ITEM_ID,
    name: 'Suspicious gadget',
    description: 'Too good to be true',
    imageId: IMAGE_ID,
    createdByUserId: TARGET_USER_ID,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    image: IMAGE,
    sources: [
      {
        id: '00000000-0000-0000-0000-000000000401',
        itemId: ITEM_ID,
        shopId: null,
        sourceUrl: 'https://phishing.example.com/deal',
        price: '9.99',
        currency: 'EUR',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        shop: null,
      },
    ],
    itemCategories: [],
    itemTags: [],
  }
}

async function authenticateReporter(reporter = REPORTER): Promise<string> {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(makeAccessTokenEntry(reporter.id))
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(reporter)
  return generateTestToken(reporter.id)
}

function mockInsertReturning(row: Report | undefined): ReturnType<typeof vi.fn> {
  const valuesSpy = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(row ? [row] : []),
  })
  vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as never)
  return valuesSpy
}

interface InsertedReport {
  userId: string
  targetType: string
  targetId: string
  targetSnapshot: Record<string, unknown>
  targetImageId: string | null
  reason: string
  description: string | null
}

function insertedReport(valuesSpy: ReturnType<typeof vi.fn>, callIndex = 0): InsertedReport {
  return valuesSpy.mock.calls[callIndex]?.[0] as InsertedReport
}

function findSensitiveKeys(snapshot: Record<string, unknown>): string[] {
  return collectKeys(snapshot).filter((key) => SENSITIVE_SNAPSHOT_KEYS.includes(key) || /token/i.test(key))
}

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys)
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, nested]) => [key, ...collectKeys(nested)])
}

function postReport(token: string | undefined, body: unknown): Promise<Response> {
  return apiRequest('/v1/reports', { method: 'POST', body, ...(token === undefined ? {} : { token }) })
}

describe('POST /v1/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 201 with a pending report and a sanitized user snapshot', async () => {
    const token = await authenticateReporter()
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...TARGET_USER, avatarImage: IMAGE } as never)
    const valuesSpy = mockInsertReturning(buildReportRow())

    const response = await postReport(token, { targetType: 'user', targetId: TARGET_USER_ID, reason: 'harassment' })

    expect(response.status).toBe(201)
    const body = reportsCreateResponseSchema.parse(await response.json())
    expect(body.report.status).toBe('pending')
    expect(body.report.description).toBeNull()
    const inserted = insertedReport(valuesSpy)
    expect(inserted).toMatchObject({ userId: REPORTER.id, targetType: 'user', targetId: TARGET_USER_ID, description: null })
    expect(inserted.targetImageId).toBe(IMAGE_ID)
    expect(inserted.targetSnapshot).toMatchObject({ id: TARGET_USER_ID, username: 'target' })
    expect(Object.keys(inserted.targetSnapshot).sort()).toEqual(['avatar', 'id', 'username'])
    expect(findSensitiveKeys(inserted.targetSnapshot)).toEqual([])
    expect(JSON.stringify(inserted.targetSnapshot)).not.toContain('target@example.com')
    expect(JSON.stringify(inserted.targetSnapshot)).not.toContain('secret-hash')
  })

  it('returns 201 for an archived list and snapshots the list detail without items nor owner email', async () => {
    const token = await authenticateReporter()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(buildListRow() as never)
    const valuesSpy = mockInsertReturning(buildReportRow({ targetType: 'list', targetId: LIST_ID }))

    const response = await postReport(token, { targetType: 'list', targetId: LIST_ID, reason: 'hate_violence' })

    expect(response.status).toBe(201)
    const inserted = insertedReport(valuesSpy)
    expect(inserted.targetImageId).toBeNull()
    expect(inserted.targetSnapshot).toMatchObject({ id: LIST_ID, listStatus: 'archived', owner: { id: TARGET_USER_ID } })
    expect(inserted.targetSnapshot).not.toHaveProperty('items')
    expect(Object.keys(inserted.targetSnapshot.owner as object).sort()).toEqual(['avatar', 'id', 'username'])
    expect(findSensitiveKeys(inserted.targetSnapshot)).toEqual([])
  })

  it('returns 201 for an item and keeps its image id as evidence', async () => {
    const token = await authenticateReporter()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(buildItemRow() as never)
    const valuesSpy = mockInsertReturning(buildReportRow({ targetType: 'item', targetId: ITEM_ID, reason: 'scam_fraud' }))

    const response = await postReport(token, {
      targetType: 'item',
      targetId: ITEM_ID,
      reason: 'scam_fraud',
      description: '  Links to a phishing shop  ',
    })

    expect(response.status).toBe(201)
    const inserted = insertedReport(valuesSpy)
    expect(inserted.targetImageId).toBe(IMAGE_ID)
    expect(inserted.description).toBe('Links to a phishing shop')
    expect(inserted.targetSnapshot).toMatchObject({
      id: ITEM_ID,
      name: 'Suspicious gadget',
      sources: [{ sourceUrl: 'https://phishing.example.com/deal' }],
    })
    expect(inserted.targetSnapshot).not.toHaveProperty('createdByUserId')
    expect(findSensitiveKeys(inserted.targetSnapshot)).toEqual([])
  })

  it('returns 201 for reason other without a description', async () => {
    const token = await authenticateReporter()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(buildItemRow() as never)
    const valuesSpy = mockInsertReturning(buildReportRow({ reason: 'other' }))

    const response = await postReport(token, { targetType: 'item', targetId: ITEM_ID, reason: 'other' })

    expect(response.status).toBe(201)
    expect(insertedReport(valuesSpy).description).toBeNull()
  })

  it('creates a new row each time the same target is reported again', async () => {
    const token = await authenticateReporter()
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(REPORTER)
    vi.mocked(db.query.items.findFirst).mockResolvedValue(buildItemRow() as never)
    const valuesSpy = mockInsertReturning(buildReportRow({ targetType: 'item', targetId: ITEM_ID }))
    const body = { targetType: 'item', targetId: ITEM_ID, reason: 'spam' }

    const first = await postReport(token, body)
    const second = await postReport(token, body)

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(valuesSpy).toHaveBeenCalledTimes(2)
  })

  it('returns 201 when users report themselves', async () => {
    const token = await authenticateReporter()
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...REPORTER, avatarImage: null } as never)
    const valuesSpy = mockInsertReturning(buildReportRow({ targetId: REPORTER.id }))

    const response = await postReport(token, { targetType: 'user', targetId: REPORTER.id, reason: 'privacy' })

    expect(response.status).toBe(201)
    expect(insertedReport(valuesSpy)).toMatchObject({ userId: REPORTER.id, targetId: REPORTER.id, targetImageId: null })
  })

  it('returns 401 without an access token', async () => {
    const response = await postReport(undefined, { targetType: 'user', targetId: TARGET_USER_ID, reason: 'spam' })

    expect(response.status).toBe(401)
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
  })

  it('returns 401 with an invalid access token', async () => {
    const response = await postReport('not-a-jwt', { targetType: 'user', targetId: TARGET_USER_ID, reason: 'spam' })

    expect(response.status).toBe(401)
  })

  it('returns 403 ACCOUNT_BANNED for a banned reporter', async () => {
    const token = await authenticateReporter(makeAdminUser({ ...REPORTER, bannedAt: new Date('2024-01-01') }))

    const response = await postReport(token, { targetType: 'user', targetId: TARGET_USER_ID, reason: 'spam' })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(403)
    expect(body.code).toBe('ACCOUNT_BANNED')
  })

  it.each([
    ['an unknown targetType', { targetType: 'reservation', targetId: TARGET_USER_ID, reason: 'spam' }],
    ['an unknown reason', { targetType: 'user', targetId: TARGET_USER_ID, reason: 'boring' }],
    ['a non-uuid targetId', { targetType: 'user', targetId: 'not-a-uuid', reason: 'spam' }],
    ['a missing targetId', { targetType: 'user', reason: 'spam' }],
    [
      'a description over the maximum length',
      { targetType: 'user', targetId: TARGET_USER_ID, reason: 'spam', description: 'a'.repeat(REPORT_DESCRIPTION_MAX_LENGTH + 1) },
    ],
    ['an unknown field', { targetType: 'user', targetId: TARGET_USER_ID, reason: 'spam', status: 'upheld' }],
  ])('returns 422 for %s', async (_label, payload) => {
    const token = await authenticateReporter()

    const response = await postReport(token, payload)

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('UNPROCESSABLE_ENTITY')
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
  })

  it('accepts a description at exactly the maximum length', async () => {
    const token = await authenticateReporter()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(buildItemRow() as never)
    mockInsertReturning(buildReportRow())

    const response = await postReport(token, {
      targetType: 'item',
      targetId: ITEM_ID,
      reason: 'spam',
      description: 'a'.repeat(REPORT_DESCRIPTION_MAX_LENGTH),
    })

    expect(response.status).toBe(201)
  })

  it.each([
    ['a nonexistent user', 'user', TARGET_USER_ID, (): void => { vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined) }],
    [
      'a soft-deleted user',
      'user',
      TARGET_USER_ID,
      (): void => {
        vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...TARGET_USER, deletedAt: new Date(), avatarImage: null } as never)
      },
    ],
    ['a nonexistent list', 'list', LIST_ID, (): void => { vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(undefined) }],
    [
      'a soft-deleted list',
      'list',
      LIST_ID,
      (): void => { vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(buildListRow({ deletedAt: new Date() }) as never) },
    ],
    ['a deleted item', 'item', ITEM_ID, (): void => { vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(undefined) }],
  ])('returns 404 REPORT_TARGET_NOT_FOUND for %s', async (_label, targetType, targetId, mockTarget) => {
    const token = await authenticateReporter()
    mockTarget()

    const response = await postReport(token, { targetType, targetId, reason: 'spam' })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('REPORT_TARGET_NOT_FOUND')
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
  })

  it('returns 500 INTERNAL_ERROR when the insert returns no row', async () => {
    const token = await authenticateReporter()
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(buildItemRow() as never)
    mockInsertReturning(undefined)

    const response = await postReport(token, { targetType: 'item', targetId: ITEM_ID, reason: 'spam' })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(500)
    expect(body.code).toBe('INTERNAL_ERROR')
  })
})

describe('user-facing report moderation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes no endpoint to change a report status', async () => {
    const token = await authenticateReporter()

    const response = await apiRequest(`/v1/reports/${REPORT_ID}`, { method: 'PATCH', token, body: { status: 'dismissed' } })

    expect(response.status).toBe(404)
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
  })
})

describe('reports table lifecycle guarantees', () => {
  const { foreignKeys } = getTableConfig(reports)
  const foreignKeyByColumn = new Map(
    foreignKeys.map((foreignKey) => [foreignKey.reference().columns[0]?.name, foreignKey.onDelete]),
  )

  it('keeps the report when its target disappears: target_id carries no foreign key', () => {
    expect(foreignKeyByColumn.has('target_id')).toBe(false)
  })

  it('keeps the report with user_id null when the reporter is hard-deleted', () => {
    expect(foreignKeyByColumn.get('user_id')).toBe('set null')
  })

  it('nulls the reviewer and the evidence image instead of deleting the report', () => {
    expect(foreignKeyByColumn.get('reviewed_by_user_id')).toBe('set null')
    expect(foreignKeyByColumn.get('target_image_id')).toBe('set null')
  })
})
