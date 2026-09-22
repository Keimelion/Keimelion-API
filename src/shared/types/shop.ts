export interface ShopDetail {
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

export interface ShopWrite {
  slug: string
  name: string
  domain: string | null
  logoUrl: string | null
  isAffiliated: boolean
  sortOrder: number
  isActive: boolean
}

export interface ShopPublic {
  id: string
  slug: string
  name: string
  domain: string | null
  logoUrl: string | null
  isAffiliated: boolean
}
