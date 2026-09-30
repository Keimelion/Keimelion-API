import { findShopsByIds } from '../shops/shops.repository.js'
import type { ItemSource } from './item-sources.schema.js'
import type { Shop } from '../shops/shops.schema.js'

export function resolveSourcesForItem(map: Map<string, ItemSource[]>, itemId: string): ItemSource[] {
  return map.get(itemId) ?? []
}

export function collectAllSources(map: Map<string, ItemSource[]>): ItemSource[] {
  const all: ItemSource[] = []
  for (const bucket of map.values()) all.push(...bucket)
  return all
}

export async function loadShopsForSources(sources: ItemSource[]): Promise<Map<string, Shop>> {
  const shopIds = new Set<string>()
  for (const source of sources) {
    if (source.shopId) shopIds.add(source.shopId)
  }
  return findShopsByIds([...shopIds])
}
