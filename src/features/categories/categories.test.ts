import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'

interface CategoryRow {
  id: string
  parentId: string | null
  name: string
  slug: string
  depth: number
  createdAt: Date
  updatedAt: Date
}

const ROOT_A: CategoryRow = {
  id: '00000000-0000-0000-0000-000000000001',
  parentId: null,
  name: 'Électronique',
  slug: 'electronique',
  depth: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const ROOT_B: CategoryRow = {
  id: '00000000-0000-0000-0000-000000000002',
  parentId: null,
  name: 'Mode & Accessoires',
  slug: 'mode-accessoires',
  depth: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const CHILD_A1: CategoryRow = {
  id: '00000000-0000-0000-0000-000000000003',
  parentId: ROOT_A.id,
  name: 'Smartphones',
  slug: 'smartphones',
  depth: 1,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const GRANDCHILD_A1: CategoryRow = {
  id: '00000000-0000-0000-0000-000000000004',
  parentId: CHILD_A1.id,
  name: 'Android',
  slug: 'android',
  depth: 2,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

interface CategoryTreeNodeShape {
  id: string
  slug: string
  name: string
  depth: number
  parentId: string | null
  children: CategoryTreeNodeShape[]
}

describe('GET /v1/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with an empty tree when there are no categories', async () => {
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([] as never)

    const response = await apiRequest('/v1/categories')

    const body = await response.json() as { categories: CategoryTreeNodeShape[] }
    expect(response.status).toBe(200)
    expect(body.categories).toHaveLength(0)
  })

  it('returns 200 with roots sorted alphabetically', async () => {
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([ROOT_B, ROOT_A] as never)

    const response = await apiRequest('/v1/categories')

    const body = await response.json() as { categories: CategoryTreeNodeShape[] }
    expect(response.status).toBe(200)
    expect(body.categories).toHaveLength(2)
    expect(body.categories[0]?.slug).toBe(ROOT_A.slug)
    expect(body.categories[1]?.slug).toBe(ROOT_B.slug)
  })

  it('nests children under their parent in the tree', async () => {
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce(
      [ROOT_A, CHILD_A1, GRANDCHILD_A1] as never,
    )

    const response = await apiRequest('/v1/categories')

    const body = await response.json() as { categories: CategoryTreeNodeShape[] }
    expect(response.status).toBe(200)
    expect(body.categories).toHaveLength(1)
    const root = body.categories[0]
    expect(root?.id).toBe(ROOT_A.id)
    expect(root?.children).toHaveLength(1)
    expect(root?.children[0]?.id).toBe(CHILD_A1.id)
    expect(root?.children[0]?.children).toHaveLength(1)
    expect(root?.children[0]?.children[0]?.id).toBe(GRANDCHILD_A1.id)
  })

  it('issues a single DB query to fetch the full tree', async () => {
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce(
      [ROOT_A, CHILD_A1, GRANDCHILD_A1] as never,
    )

    await apiRequest('/v1/categories')

    expect(vi.mocked(db.query.categories.findMany)).toHaveBeenCalledTimes(1)
  })

  it('does not require authentication', async () => {
    vi.mocked(db.query.categories.findMany).mockResolvedValueOnce([ROOT_A] as never)

    const response = await apiRequest('/v1/categories')
    expect(response.status).toBe(200)
  })
})
