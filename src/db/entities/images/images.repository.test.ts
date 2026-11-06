import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PgDialect, QueryBuilder } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { db } from '../../client.js'
import { deleteImageById, deleteUnreferencedImages } from './images.repository.js'

const IMAGE_ID = '00000000-0000-0000-0000-000000000500'
const PENDING_REPORT_GUARD =
  'not exists (select "id" from "reports" where ("reports"."target_image_id" = "images"."id" and "reports"."report_status" = $'

function mockDeleteWhere(): ReturnType<typeof vi.fn> {
  const whereSpy = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) })
  vi.mocked(db.delete).mockReturnValue({ where: whereSpy } as never)
  return whereSpy
}

function renderedWhere(whereSpy: ReturnType<typeof vi.fn>): { sql: string; params: unknown[] } {
  return new PgDialect().sqlToQuery(whereSpy.mock.calls[0]?.[0] as SQL)
}

describe('images repository — evidence of pending reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const queryBuilder = new QueryBuilder()
    vi.mocked(db.select).mockImplementation(((fields: never) => queryBuilder.select(fields)) as never)
  })

  it('orphan cleanup skips images referenced by a pending report', async () => {
    const whereSpy = mockDeleteWhere()

    await deleteUnreferencedImages(new Date('2024-01-01'))

    const where = renderedWhere(whereSpy)
    expect(where.sql).toContain(PENDING_REPORT_GUARD)
    expect(where.params).toContain('pending')
    expect(where.params).not.toContain('upheld')
    expect(where.params).not.toContain('dismissed')
  })

  it('replacing or clearing an image keeps it while a pending report references it', async () => {
    const whereSpy = mockDeleteWhere()

    await deleteImageById(IMAGE_ID)

    const where = renderedWhere(whereSpy)
    expect(where.sql).toContain('"images"."id" = $1')
    expect(where.sql).toContain(PENDING_REPORT_GUARD)
    expect(where.params).toEqual([IMAGE_ID, 'pending'])
  })
})
