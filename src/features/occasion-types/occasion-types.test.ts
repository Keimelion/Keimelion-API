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

const OCCASION_TYPE_MARIAGE_FR = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'mariage',
  label: 'Mariage',
  emoji: '💍',
  sortOrder: 10,
  isActive: true,
}

const OCCASION_TYPE_MARIAGE_EN = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'mariage',
  label: 'Wedding',
  emoji: '💍',
  sortOrder: 10,
  isActive: true,
}

const OCCASION_TYPE_NAISSANCE_FR = {
  id: '00000000-0000-0000-0000-000000000002',
  slug: 'naissance',
  label: 'Naissance',
  emoji: '👶',
  sortOrder: 20,
  isActive: true,
}

const OCCASION_TYPE_INACTIVE = {
  id: '00000000-0000-0000-0000-000000000003',
  slug: 'archived',
  label: 'Archived',
  emoji: null,
  sortOrder: 99,
  isActive: false,
}

function buildSelectChain(orderByFn: () => Promise<unknown>): Record<string, unknown> {
  const chain: {
    orderBy: ReturnType<typeof vi.fn>
    where: ReturnType<typeof vi.fn>
    leftJoin: ReturnType<typeof vi.fn>
    from: ReturnType<typeof vi.fn>
  } = {
    orderBy: vi.fn(orderByFn),
    where: vi.fn(),
    leftJoin: vi.fn(),
    from: vi.fn(),
  }
  chain.where.mockReturnValue(chain)
  chain.leftJoin.mockReturnValue(chain)
  chain.from.mockReturnValue(chain)
  return chain
}

function mockSelectRows(rows: unknown[]): void {
  const chain = buildSelectChain(() => Promise.resolve(rows))
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function mockSelectThrows(error: Error): void {
  const chain = buildSelectChain(() => Promise.reject(error))
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

describe('GET /v1/occasion-types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with active occasion types', async () => {
    mockSelectRows([OCCASION_TYPE_MARIAGE_FR, OCCASION_TYPE_NAISSANCE_FR])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')
    const body = (await response.json()) as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body).toHaveLength(2)
  })

  it('returns occasion types with expected shape: id, slug, label, emoji only', async () => {
    mockSelectRows([OCCASION_TYPE_MARIAGE_FR])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')
    const body = (await response.json()) as PublicOccasionType[]

    expect(response.status).toBe(200)
    const item = body[0]
    expect(item).toBeDefined()
    expect(item).toHaveProperty('id', OCCASION_TYPE_MARIAGE_FR.id)
    expect(item).toHaveProperty('slug', OCCASION_TYPE_MARIAGE_FR.slug)
    expect(item).toHaveProperty('label', OCCASION_TYPE_MARIAGE_FR.label)
    expect(item).toHaveProperty('emoji', OCCASION_TYPE_MARIAGE_FR.emoji)
    expect(item).not.toHaveProperty('sortOrder')
    expect(item).not.toHaveProperty('isActive')
    expect(item).not.toHaveProperty('createdAt')
    expect(item).not.toHaveProperty('updatedAt')
  })

  it('does not include inactive occasion types in the response', async () => {
    mockSelectRows([OCCASION_TYPE_MARIAGE_FR, OCCASION_TYPE_NAISSANCE_FR])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')
    const body = (await response.json()) as PublicOccasionType[]

    expect(response.status).toBe(200)
    const slugs = body.map((item) => item.slug)
    expect(slugs).not.toContain(OCCASION_TYPE_INACTIVE.slug)
  })

  it('returns items sorted by sort_order ascending', async () => {
    mockSelectRows([OCCASION_TYPE_MARIAGE_FR, OCCASION_TYPE_NAISSANCE_FR])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')
    const body = (await response.json()) as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body[0]?.slug).toBe('mariage')
    expect(body[1]?.slug).toBe('naissance')
  })

  it('returns an empty array when no active occasion types exist', async () => {
    mockSelectRows([])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')
    const body = (await response.json()) as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body).toHaveLength(0)
    expect(Array.isArray(body)).toBe(true)
  })

  it('returns null emoji for occasion types that have no emoji', async () => {
    const occasionWithoutEmoji = { ...OCCASION_TYPE_MARIAGE_FR, emoji: null }
    mockSelectRows([occasionWithoutEmoji])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')
    const body = (await response.json()) as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body[0]?.emoji).toBeNull()
  })

  it('does not require an Authorization token', async () => {
    mockSelectRows([OCCASION_TYPE_MARIAGE_FR])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')

    expect(response.status).toBe(200)
  })

  it('returns 500 when the database throws', async () => {
    mockSelectThrows(new Error('DB failure'))

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')

    expect(response.status).toBe(500)
  })

  it('returns French labels when Accept-Language is fr', async () => {
    mockSelectRows([OCCASION_TYPE_MARIAGE_FR])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types', {
      headers: { 'Accept-Language': 'fr' },
    })
    const body = (await response.json()) as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body[0]?.label).toBe('Mariage')
  })

  it('returns English labels when Accept-Language is en', async () => {
    mockSelectRows([OCCASION_TYPE_MARIAGE_EN])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types', {
      headers: { 'Accept-Language': 'en' },
    })
    const body = (await response.json()) as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body[0]?.label).toBe('Wedding')
  })

  it('resolves locale from Accept-Language with quality factors (en-US,en;q=0.9)', async () => {
    mockSelectRows([OCCASION_TYPE_MARIAGE_EN])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types', {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    })
    const body = (await response.json()) as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body[0]?.label).toBe('Wedding')
  })

  it('falls back to French when Accept-Language is an unsupported locale (de)', async () => {
    mockSelectRows([OCCASION_TYPE_MARIAGE_FR])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types', {
      headers: { 'Accept-Language': 'de' },
    })
    const body = (await response.json()) as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body[0]?.label).toBe('Mariage')
  })

  it('falls back to French when no Accept-Language header is present', async () => {
    mockSelectRows([OCCASION_TYPE_MARIAGE_FR])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types')
    const body = (await response.json()) as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body[0]?.label).toBe('Mariage')
  })

  it('returns French label as fallback when only FR translation exists and EN is requested', async () => {
    const onlyFrTranslation = { ...OCCASION_TYPE_MARIAGE_FR, label: 'Mariage' }
    mockSelectRows([onlyFrTranslation])

    const { app } = await import('../../app.js')
    const response = await app.request('/v1/occasion-types', {
      headers: { 'Accept-Language': 'en' },
    })
    const body = (await response.json()) as PublicOccasionType[]

    expect(response.status).toBe(200)
    expect(body[0]?.label).toBe('Mariage')
  })
})
