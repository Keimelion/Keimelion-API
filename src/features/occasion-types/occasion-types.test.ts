import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import type { PublicOccasionType } from './occasion-types.mapper.js'

vi.mock('../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const OCCASION_TYPE_MARIAGE = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'mariage',
  label: 'Mariage',
  emoji: '💍',
  sortOrder: 10,
  isActive: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

const OCCASION_TYPE_NAISSANCE = {
  id: '00000000-0000-0000-0000-000000000002',
  slug: 'naissance',
  label: 'Naissance',
  emoji: '👶',
  sortOrder: 20,
  isActive: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

const OCCASION_TYPE_INACTIVE = {
  id: '00000000-0000-0000-0000-000000000003',
  slug: 'archived',
  label: 'Archived',
  emoji: null,
  sortOrder: 99,
  isActive: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

function mockSelectChain(rows: unknown[]): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValueOnce(rows),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

describe('GET /v1/occasion-types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with active occasion types', async () => {
    mockSelectChain([OCCASION_TYPE_MARIAGE, OCCASION_TYPE_NAISSANCE])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')
    const body = await response.json() as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body).toHaveLength(2)
  })

  it('returns occasion types with expected shape: id, slug, label, emoji only', async () => {
    mockSelectChain([OCCASION_TYPE_MARIAGE])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')
    const body = await response.json() as PublicOccasionType[]

    expect(response.status).toBe(200)
    const item = body[0]
    expect(item).toBeDefined()
    expect(item).toHaveProperty('id', OCCASION_TYPE_MARIAGE.id)
    expect(item).toHaveProperty('slug', OCCASION_TYPE_MARIAGE.slug)
    expect(item).toHaveProperty('label', OCCASION_TYPE_MARIAGE.label)
    expect(item).toHaveProperty('emoji', OCCASION_TYPE_MARIAGE.emoji)
    expect(item).not.toHaveProperty('sortOrder')
    expect(item).not.toHaveProperty('isActive')
    expect(item).not.toHaveProperty('createdAt')
    expect(item).not.toHaveProperty('updatedAt')
  })

  it('does not include inactive occasion types in the response', async () => {
    mockSelectChain([OCCASION_TYPE_MARIAGE, OCCASION_TYPE_NAISSANCE])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')
    const body = await response.json() as PublicOccasionType[]

    expect(response.status).toBe(200)
    const slugs = body.map((item) => item.slug)
    expect(slugs).not.toContain(OCCASION_TYPE_INACTIVE.slug)
  })

  it('returns items sorted by sort_order ascending', async () => {
    mockSelectChain([OCCASION_TYPE_MARIAGE, OCCASION_TYPE_NAISSANCE])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')
    const body = await response.json() as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body[0]?.slug).toBe('mariage')
    expect(body[1]?.slug).toBe('naissance')
  })

  it('returns an empty array when no active occasion types exist', async () => {
    mockSelectChain([])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')
    const body = await response.json() as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body).toHaveLength(0)
    expect(Array.isArray(body)).toBe(true)
  })

  it('returns null emoji for occasion types that have no emoji', async () => {
    const occasionWithoutEmoji = { ...OCCASION_TYPE_MARIAGE, emoji: null }
    mockSelectChain([occasionWithoutEmoji])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')
    const body = await response.json() as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body[0]?.emoji).toBeNull()
  })

  it('does not require an Authorization token', async () => {
    mockSelectChain([OCCASION_TYPE_MARIAGE])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')

    expect(response.status).toBe(200)
  })

  it('returns 500 when the database throws', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockRejectedValueOnce(new Error('DB failure')),
    }
    vi.mocked(db.select).mockReturnValueOnce(chain as never)

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')

    expect(response.status).toBe(500)
  })
})
