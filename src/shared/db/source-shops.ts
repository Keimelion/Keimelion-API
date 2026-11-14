import { extractDomainCandidates } from '../utils/host.js'
import { findShopsByDomains } from '../../db/entities/shops/shops.repository.js'
import type { Shop } from '../../db/entities/shops/shops.schema.js'

export async function resolveSourceShops(sourceUrls: (string | null)[]): Promise<(Shop | null)[]> {
  const candidatesPerUrl = sourceUrls.map((sourceUrl) =>
    sourceUrl === null ? [] : extractDomainCandidates(sourceUrl),
  )
  const uniqueCandidates = Array.from(new Set(candidatesPerUrl.flat()))
  if (uniqueCandidates.length === 0) return sourceUrls.map(() => null)

  const matchingShops = await findShopsByDomains(uniqueCandidates)
  const shopByDomain = new Map(matchingShops.map((shop) => [shop.domain, shop]))
  return candidatesPerUrl.map((candidates) => findMostSpecificShop(candidates, shopByDomain))
}

export async function resolveSourceShop(sourceUrl: string | null): Promise<Shop | null> {
  const [shop] = await resolveSourceShops([sourceUrl])
  return shop ?? null
}

function findMostSpecificShop(candidates: string[], shopByDomain: Map<string | null, Shop>): Shop | null {
  return candidates.map((candidate) => shopByDomain.get(candidate)).find((shop) => shop !== undefined) ?? null
}
