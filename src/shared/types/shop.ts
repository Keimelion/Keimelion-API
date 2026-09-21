export interface BaseShop {
  id: string
  slug: string
  name: string
  domain: string | null
  logoUrl: string | null
  isAffiliated: boolean
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
