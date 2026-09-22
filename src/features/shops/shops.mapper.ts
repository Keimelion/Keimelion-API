import type { Shop } from '../../db/entities/shops/shops.schema.js'
import type { ShopDetail } from '../../shared/types/shop.js'

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
