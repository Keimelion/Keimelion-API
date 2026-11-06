import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  REPORT_ADMIN_NOTE_MAX_LENGTH,
  adminReportsGetResponseSchema,
  adminReportsListResponseSchema,
  adminReportsUpdateResponseSchema,
} from '@keimelion/sdk/schemas'
import { db } from '../../../db/client.js'
import { apiRequest } from '../../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../../shared/test/auth.js'
import { ADMIN_USER_FIXTURE as ADMIN_USER, makeAdminUser } from '../../../shared/test/fixtures/users.js'
import { logger } from '../../../shared/utils/logger.js'
import type { ReportRowWithReporter } from './admin-reports.mapper.js'

vi.mock('../../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const NON_ADMIN_USER = makeAdminUser({
  id: '00000000-0000-0000-0000-000000000002',
  email: 'user@example.com',
  role: 'user',
})

const REPORTER = { id: '00000000-0000-0000-0000-000000000050', username: 'reporter' }
const REPORT_ID = '00000000-0000-0000-0000-000000000100'
const TARGET_ID = '00000000-0000-0000-0000-000000000200'
const TARGET_SNAPSHOT = { id: TARGET_ID, name: 'Original item name', createdAt: '2024-01-01T00:00:00.000Z' }

function buildReportRow(overrides: Partial<ReportRowWithReporter> = {}): ReportRowWithReporter {
  return {
    id: REPORT_ID,
    userId: REPORTER.id,
    targetType: 'item',
    targetId: TARGET_ID,
    targetSnapshot: TARGET_SNAPSHOT,
    targetImageId: null,
    reason: 'spam',
    description: 'Repeated advertising',
    reportStatus: 'pending',
    adminNote: null,
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
    reporter: REPORTER,
    ...overrides,
  }
}

async function adminToken(): Promise<string> {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(makeAccessTokenEntry(ADMIN_USER.id))
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
  return generateTestToken(ADMIN_USER.id, { role: 'admin' })
}

async function nonAdminToken(): Promise<string> {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(makeAccessTokenEntry(NON_ADMIN_USER.id))
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(NON_ADMIN_USER)
  return generateTestToken(NON_ADMIN_USER.id)
}

function mockCountChain(total: number): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ count: total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function mockUpdateReturning(row: ReportRowWithReporter): ReturnType<typeof vi.fn> {
  const setSpy = vi.fn().mockReturnValueOnce({
    where: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([row]),
    }),
  })
  vi.mocked(db.update).mockReturnValueOnce({ set: setSpy } as never)
  return setSpy
}

function renderWhere(where: unknown): { sql: string; params: unknown[] } {
  return new PgDialect().sqlToQuery(where as SQL)
}

describe('GET /v1/admin/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with paginated reports sorted by createdAt desc by default', async () => {
    const token = await adminToken()
    vi.mocked(db.query.reports.findMany).mockResolvedValueOnce([buildReportRow()])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/reports', { token })

    expect(response.status).toBe(200)
    const body = adminReportsListResponseSchema.parse(await response.json())
    expect(body.pagination.total).toBe(1)
    expect(body.items[0]).toMatchObject({
      id: REPORT_ID,
      userId: REPORTER.id,
      reporter: REPORTER,
      targetType: 'item',
      targetId: TARGET_ID,
      targetSnapshot: TARGET_SNAPSHOT,
      reason: 'spam',
      status: 'pending',
      adminNote: null,
      reviewedByUserId: null,
      reviewedAt: null,
    })
    const query = vi.mocked(db.query.reports.findMany).mock.calls[0]?.[0]
    const orderBy = (query?.orderBy ?? []) as SQL[]
    expect(orderBy.map((clause) => renderWhere(clause).sql)).toEqual(['"reports"."created_at" desc'])
  })

  it('filters by status, targetType and targetId', async () => {
    const token = await adminToken()
    vi.mocked(db.query.reports.findMany).mockResolvedValueOnce([buildReportRow()])
    mockCountChain(1)

    const response = await apiRequest(
      `/v1/admin/reports?status%5Beq%5D=pending&targetType%5Beq%5D=item&targetId%5Beq%5D=${TARGET_ID}`,
      { token },
    )

    expect(response.status).toBe(200)
    const query = vi.mocked(db.query.reports.findMany).mock.calls[0]?.[0]
    const where = renderWhere(query?.where)
    expect(where.sql).toContain('"reports"."report_status" = $')
    expect(where.sql).toContain('"reports"."target_type" = $')
    expect(where.sql).toContain('"reports"."target_id" = $')
    expect(where.params).toEqual(expect.arrayContaining(['pending', 'item', TARGET_ID]))
  })

  it('exposes a report whose reporter was hard-deleted with userId and reporter null', async () => {
    const token = await adminToken()
    vi.mocked(db.query.reports.findMany).mockResolvedValueOnce([buildReportRow({ userId: null, reporter: null })])
    mockCountChain(1)

    const response = await apiRequest('/v1/admin/reports', { token })

    const body = adminReportsListResponseSchema.parse(await response.json())
    expect(body.items[0]?.userId).toBeNull()
    expect(body.items[0]?.reporter).toBeNull()
  })

  it('respects pagination params', async () => {
    const token = await adminToken()
    vi.mocked(db.query.reports.findMany).mockResolvedValueOnce([buildReportRow()])
    mockCountChain(5)

    const response = await apiRequest('/v1/admin/reports?page=2&limit=2', { token })

    const body = adminReportsListResponseSchema.parse(await response.json())
    expect(body.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 })
  })

  it.each([
    ['an unknown status filter', 'status%5Beq%5D=approved'],
    ['an unknown targetType filter', 'targetType%5Beq%5D=reservation'],
    ['a non-uuid targetId filter', 'targetId%5Beq%5D=not-a-uuid'],
  ])('returns 422 for %s', async (_label, queryString) => {
    const token = await adminToken()

    const response = await apiRequest(`/v1/admin/reports?${queryString}`, { token })

    expect(response.status).toBe(422)
  })

  it('returns 403 for a non-admin user', async () => {
    const token = await nonAdminToken()

    const response = await apiRequest('/v1/admin/reports', { token })

    expect(response.status).toBe(403)
  })

  it('returns 401 without an access token', async () => {
    const response = await apiRequest('/v1/admin/reports')

    expect(response.status).toBe(401)
  })
})

describe('GET /v1/admin/reports/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with the original snapshot even though the target is gone', async () => {
    const token = await adminToken()
    vi.mocked(db.query.reports.findFirst).mockResolvedValueOnce(buildReportRow())

    const response = await apiRequest(`/v1/admin/reports/${REPORT_ID}`, { token })

    expect(response.status).toBe(200)
    const body = adminReportsGetResponseSchema.parse(await response.json())
    expect(body.report.targetId).toBe(TARGET_ID)
    expect(body.report.targetSnapshot).toEqual(TARGET_SNAPSHOT)
    expect(vi.mocked(db.query.items.findFirst)).not.toHaveBeenCalled()
  })

  it('returns 404 REPORT_NOT_FOUND for an unknown id', async () => {
    const token = await adminToken()
    vi.mocked(db.query.reports.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/admin/reports/${REPORT_ID}`, { token })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('REPORT_NOT_FOUND')
  })

  it('returns 422 for a non-uuid id', async () => {
    const token = await adminToken()

    const response = await apiRequest('/v1/admin/reports/not-a-uuid', { token })

    expect(response.status).toBe(422)
  })

  it('returns 403 for a non-admin user', async () => {
    const token = await nonAdminToken()

    const response = await apiRequest(`/v1/admin/reports/${REPORT_ID}`, { token })

    expect(response.status).toBe(403)
  })
})

describe('PATCH /v1/admin/reports/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets the reviewer and review date when the status changes', async () => {
    const token = await adminToken()
    vi.mocked(db.query.reports.findFirst).mockResolvedValueOnce(buildReportRow())
    const reviewedAt = new Date('2024-03-01')
    const setSpy = mockUpdateReturning(
      buildReportRow({ reportStatus: 'upheld', reviewedByUserId: ADMIN_USER.id, reviewedAt, reporter: null }),
    )

    const response = await apiRequest(`/v1/admin/reports/${REPORT_ID}`, {
      method: 'PATCH',
      token,
      body: { status: 'upheld' },
    })

    expect(response.status).toBe(200)
    const body = adminReportsUpdateResponseSchema.parse(await response.json())
    expect(body.report).toMatchObject({ status: 'upheld', reviewedByUserId: ADMIN_USER.id, reporter: REPORTER })
    const fields = setSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(fields).toMatchObject({ reportStatus: 'upheld', reviewedByUserId: ADMIN_USER.id })
    expect(fields.reviewedAt).toBeInstanceOf(Date)
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_update_report', reportId: REPORT_ID }),
    )
  })

  it('updates only the admin note without touching the review fields', async () => {
    const token = await adminToken()
    vi.mocked(db.query.reports.findFirst).mockResolvedValueOnce(buildReportRow())
    const setSpy = mockUpdateReturning(buildReportRow({ adminNote: 'Checked the shop link' }))

    const response = await apiRequest(`/v1/admin/reports/${REPORT_ID}`, {
      method: 'PATCH',
      token,
      body: { adminNote: '  Checked the shop link  ' },
    })

    expect(response.status).toBe(200)
    expect(setSpy.mock.calls[0]?.[0]).toEqual({ adminNote: 'Checked the shop link' })
  })

  it('clears the admin note with null', async () => {
    const token = await adminToken()
    vi.mocked(db.query.reports.findFirst).mockResolvedValueOnce(buildReportRow({ adminNote: 'Old note' }))
    const setSpy = mockUpdateReturning(buildReportRow())

    const response = await apiRequest(`/v1/admin/reports/${REPORT_ID}`, {
      method: 'PATCH',
      token,
      body: { adminNote: null },
    })

    expect(response.status).toBe(200)
    expect(setSpy.mock.calls[0]?.[0]).toEqual({ adminNote: null })
  })

  it('skips the UPDATE when nothing changes', async () => {
    const token = await adminToken()
    vi.mocked(db.query.reports.findFirst).mockResolvedValueOnce(buildReportRow({ reportStatus: 'dismissed' }))

    const response = await apiRequest(`/v1/admin/reports/${REPORT_ID}`, {
      method: 'PATCH',
      token,
      body: { status: 'dismissed' },
    })

    expect(response.status).toBe(200)
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
  })

  it('returns 422 NO_FIELDS_TO_UPDATE for an empty body', async () => {
    const token = await adminToken()

    const response = await apiRequest(`/v1/admin/reports/${REPORT_ID}`, { method: 'PATCH', token, body: {} })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('NO_FIELDS_TO_UPDATE')
    expect(vi.mocked(db.query.reports.findFirst)).not.toHaveBeenCalled()
  })

  it.each([
    ['an unknown status', { status: 'approved' }],
    ['an admin note over the maximum length', { adminNote: 'a'.repeat(REPORT_ADMIN_NOTE_MAX_LENGTH + 1) }],
    ['an unknown field', { status: 'upheld', reason: 'other' }],
  ])('returns 422 for %s', async (_label, payload) => {
    const token = await adminToken()

    const response = await apiRequest(`/v1/admin/reports/${REPORT_ID}`, { method: 'PATCH', token, body: payload })

    expect(response.status).toBe(422)
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
  })

  it('returns 404 REPORT_NOT_FOUND for an unknown id', async () => {
    const token = await adminToken()
    vi.mocked(db.query.reports.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/admin/reports/${REPORT_ID}`, {
      method: 'PATCH',
      token,
      body: { status: 'upheld' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('REPORT_NOT_FOUND')
  })

  it('returns 403 for a non-admin user', async () => {
    const token = await nonAdminToken()

    const response = await apiRequest(`/v1/admin/reports/${REPORT_ID}`, {
      method: 'PATCH',
      token,
      body: { status: 'upheld' },
    })

    expect(response.status).toBe(403)
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
  })
})
