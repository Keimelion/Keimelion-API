import { extractDomainCandidates } from '../utils/host.js'
import { findShopsByDomains } from '../../db/entities/shops/shops.repository.js'

// Resolves each source URL to the id of the shop with the most specific matching domain.
export async function resolveSourceShopIds(sourceUrls: (string | null)[]): Promise<(string | null)[]> {
  const candidatesPerUrl = sourceUrls.map((sourceUrl) => (sourceUrl === null ? [] : extractDomainCandidates(sourceUrl)))
  const uniqueCandidates = [...new Set(candidatesPerUrl.flat())]
  if (uniqueCandidates.length === 0) return sourceUrls.map(() => null)

  const shops = await findShopsByDomains(uniqueCandidates)
  const shopIdByDomain = new Map(shops.map((shop) => [shop.domain, shop.id]))
  return candidatesPerUrl.map(
    (candidates) => candidates.map((candidate) => shopIdByDomain.get(candidate)).find((id) => id !== undefined) ?? null,
  )
}

export async function resolveSourceShopId(sourceUrl: string | null): Promise<string | null> {
  const [shopId] = await resolveSourceShopIds([sourceUrl])
  return shopId ?? null
}
