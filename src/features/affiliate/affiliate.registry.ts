import { normalizeUrlWithDefaults } from './strategies/default.strategy.js'
import { AMAZON_SHOP_SLUG, amazonUrlStrategy } from './strategies/amazon.strategy.js'

export interface ShopUrlStrategy {
  normalize?: (url: URL) => URL
  buildAffiliateUrl?: (sourceUrl: string) => Promise<string | null>
}

interface ResolvedShopUrlStrategy {
  normalize: (url: URL) => URL
  buildAffiliateUrl: ((sourceUrl: string) => Promise<string | null>) | null
}

const SHOP_URL_STRATEGIES: ReadonlyMap<string, ShopUrlStrategy> = new Map([
  [AMAZON_SHOP_SLUG, amazonUrlStrategy],
])

export const AFFILIATE_SHOP_SLUGS: readonly string[] = [...SHOP_URL_STRATEGIES]
  .filter(([, strategy]) => strategy.buildAffiliateUrl !== undefined)
  .map(([shopSlug]) => shopSlug)

export function resolveShopUrlStrategy(shopSlug: string | null): ResolvedShopUrlStrategy {
  const strategy = shopSlug === null ? undefined : SHOP_URL_STRATEGIES.get(shopSlug)
  return {
    normalize: strategy?.normalize ?? normalizeUrlWithDefaults,
    buildAffiliateUrl: strategy?.buildAffiliateUrl ?? null,
  }
}
