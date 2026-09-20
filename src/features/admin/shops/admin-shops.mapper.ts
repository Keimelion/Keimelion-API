import type { Shop } from '../../../db/entities/shops/shops.schema.js'
import type { BaseShop } from '../../../shared/types/shop.js'
import { toBaseShop } from '../../shops/shops.mapper.js'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AdminShop extends BaseShop {}

export function toAdminShop(row: Shop): AdminShop {
  return toBaseShop(row)
}
