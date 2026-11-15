import { extractDomainCandidates } from '../utils/host.js'
import { findShopsByIdsOrDomains } from '../../db/entities/shops/shops.repository.js'
import type { Shop } from '../../db/entities/shops/shops.schema.js'

export interface SourceShopLookup {
  shopId: string | null
  sourceUrl: string | null
}

// For each source with a URL, returns the shop whose URL strategy applies: the explicit shop when set,
// otherwise the shop with the most specific domain matching the URL. Sources without a URL get null.
export async function resolveSourceShops(lookups: SourceShopLookup[]): Promise<(Shop | null)[]> {
  const shopIds = lookups.flatMap((lookup) => (lookup.sourceUrl !== null && lookup.shopId !== null ? [lookup.shopId] : []))
  const candidatesPerLookup = lookups.map(extractLookupDomainCandidates)

  const shops = await findShopsByIdsOrDomains([...new Set(shopIds)], [...new Set(candidatesPerLookup.flat())])
  const shopById = new Map(shops.map((shop) => [shop.id, shop]))
  const shopByDomain = new Map(shops.flatMap((shop) => (shop.domain === null ? [] : [[shop.domain, shop] as const])))

  return lookups.map((lookup, index) => {
    if (lookup.sourceUrl === null) return null
    if (lookup.shopId !== null) return shopById.get(lookup.shopId) ?? null
    const candidates = candidatesPerLookup[index] ?? []
    return candidates.map((candidate) => shopByDomain.get(candidate)).find((shop) => shop !== undefined) ?? null
  })
}

export async function resolveSourceShop(lookup: SourceShopLookup): Promise<Shop | null> {
  const [shop] = await resolveSourceShops([lookup])
  return shop ?? null
}

function extractLookupDomainCandidates(lookup: SourceShopLookup): string[] {
  if (lookup.sourceUrl === null || lookup.shopId !== null) return []
  return extractDomainCandidates(lookup.sourceUrl)
}
