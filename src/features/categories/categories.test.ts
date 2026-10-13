import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'

interface CategoryRow {
  id: string
  parentId: string | null
  name: string
  slug: string
  depth: number
}

const ROOT_A: CategoryRow = {
  id: '00000000-0000-0000-0000-000000000001',
  parentId: null,
  name: 'Electronics',
  slug: 'electronics',
  depth: 0,
}

const ROOT_A_FR: CategoryRow = { ...ROOT_A, name: 'Électronique' }

const ROOT_B: CategoryRow = {
  id: '00000000-0000-0000-0000-000000000002',
  parentId: null,
  name: 'Fashion & Accessories',
  slug: 'fashion-accessories',
  depth: 0,
}

const CHILD_A1: CategoryRow = {
  id: '00000000-0000-0000-0000-000000000003',
  parentId: ROOT_A.id,
  name: 'Smartphones',
  slug: 'smartphones',
  depth: 1,
}

const GRANDCHILD_A1: CategoryRow = {
  id: '00000000-0000-0000-0000-000000000004',
  parentId: CHILD_A1.id,
  name: 'Android',
  slug: 'android',
  depth: 2,
}

interface CategoryTreeNodeShape {
  id: string
  slug: string
  name: string
  depth: number
  parentId: string | null
  children: CategoryTreeNodeShape[]
}

function mockFindAllCategoriesOrdered(rows: CategoryRow[]): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValueOnce(rows),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

describe('GET /v1/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with an empty tree when there are no categories', async () => {
    mockFindAllCategoriesOrdered([])

    const response = await apiRequest('/v1/categories')

    const body = (await response.json()) as { categories: CategoryTreeNodeShape[] }
    expect(response.status).toBe(200)
    expect(body.categories).toHaveLength(0)
  })

  it('returns 200 with roots sorted alphabetically', async () => {
    mockFindAllCategoriesOrdered([ROOT_B, ROOT_A])

    const response = await apiRequest('/v1/categories')

    const body = (await response.json()) as { categories: CategoryTreeNodeShape[] }
    expect(response.status).toBe(200)
    expect(body.categories).toHaveLength(2)
    expect(body.categories[0]?.slug).toBe(ROOT_A.slug)
    expect(body.categories[1]?.slug).toBe(ROOT_B.slug)
  })

  it('nests children under their parent in the tree', async () => {
    mockFindAllCategoriesOrdered([ROOT_A, CHILD_A1, GRANDCHILD_A1])

    const response = await apiRequest('/v1/categories')

    const body = (await response.json()) as { categories: CategoryTreeNodeShape[] }
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
    mockFindAllCategoriesOrdered([ROOT_A, CHILD_A1, GRANDCHILD_A1])

    await apiRequest('/v1/categories')

    expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1)
  })

  it('does not require authentication', async () => {
    mockFindAllCategoriesOrdered([ROOT_A])

    const response = await apiRequest('/v1/categories')
    expect(response.status).toBe(200)
  })

  it('returns English names by default when no Accept-Language is provided', async () => {
    mockFindAllCategoriesOrdered([ROOT_A])

    const response = await apiRequest('/v1/categories')
    const body = (await response.json()) as { categories: CategoryTreeNodeShape[] }

    expect(response.status).toBe(200)
    expect(body.categories[0]?.name).toBe('Electronics')
  })

  it('returns French names when Accept-Language: fr is provided', async () => {
    mockFindAllCategoriesOrdered([ROOT_A_FR])

    const response = await apiRequest('/v1/categories', { headers: { 'Accept-Language': 'fr' } })
    const body = (await response.json()) as { categories: CategoryTreeNodeShape[] }

    expect(response.status).toBe(200)
    expect(body.categories[0]?.name).toBe('Électronique')
  })

  it('falls back to the default locale when the requested locale translation is missing', async () => {
    mockFindAllCategoriesOrdered([ROOT_A])

    const response = await apiRequest('/v1/categories', { headers: { 'Accept-Language': 'fr' } })
    const body = (await response.json()) as { categories: CategoryTreeNodeShape[] }

    expect(response.status).toBe(200)
    expect(body.categories[0]?.name).toBe('Electronics')
  })
})
