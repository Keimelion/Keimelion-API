import type { Shop } from '../../db/entities/shops/shops.schema.js'
import type { ShopDetailParsed, ShopSummaryParsed } from '@keimelion/sdk/schemas'

export type ShopPublic = ShopSummaryParsed

export type ShopDetail = ShopDetailParsed

export interface ShopWrite {
  slug: string
  name: string
  domain: string | null
  logoUrl: string | null
  isAffiliated: boolean
  sortOrder: number
  isActive: boolean
}

export function toShopDetail(row: Shop): ShopDetail {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    domain: row.domain ?? null,
    logoUrl: row.logoUrl ?? null,
    isAffiliated: row.isAffiliated,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toShopPublic(row: Shop): ShopPublic {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    domain: row.domain ?? null,
    logoUrl: row.logoUrl ?? null,
    isAffiliated: row.isAffiliated,
  }
}
