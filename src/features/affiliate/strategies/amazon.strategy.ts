import { env } from '../../../config/env.js'
import type { ShopUrlStrategy } from '../affiliate.registry.js'
import { normalizeUrlWithDefaults, removeQueryParams } from './default.strategy.js'

export const AMAZON_SHOP_SLUG = 'amazon'

const ASIN_PATH_REGEX =
  /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin|o\/asin)\/([a-z0-9]{10})(?:[/?]|$)/i
// Storefront hosts (amazon.fr, m.amazon.co.uk, smile.amazon.com…) capture the bare storefront domain.
const STOREFRONT_HOST_REGEX = /^(?:(?:www|m|smile)\.)?(amazon\.(?:com?\.)?[a-z]{2,3})$/i
const CANONICAL_HOST_PREFIX = 'www.'
const AFFILIATE_PARAM_DENYLIST = /^(?:tag|ascsubtag|linkcode|linkid)$/i
const ASSOCIATE_TAG_PARAM = 'tag'
const QUERY_SEPARATOR = '&'

interface AmazonStrategyConfig {
  associateTag: string | undefined
}

// Without an associate tag the strategy builds no links at all, so Amazon stays out of
// AFFILIATE_SHOP_SLUGS and the generation job does not scan its sources for nothing.
export function createAmazonUrlStrategy(config: AmazonStrategyConfig): ShopUrlStrategy {
  const { associateTag } = config
  if (!associateTag) return { normalize: normalizeAmazonUrl }

  return {
    normalize: normalizeAmazonUrl,
    buildAffiliateUrl: (sourceUrl) => Promise.resolve(buildAmazonAffiliateUrl(sourceUrl, associateTag)),
  }
}

export const amazonUrlStrategy = createAmazonUrlStrategy({ associateTag: env.AMAZON_ASSOCIATE_TAG })

// Product pages collapse to /dp/<ASIN> so every variant of the same link shares one URL; other pages
// keep their path and only lose tracking and third-party affiliate parameters.
function normalizeAmazonUrl(url: URL): URL {
  const asin = ASIN_PATH_REGEX.exec(url.pathname)?.[1]
  if (asin === undefined) return removeTrackingAndAffiliateParams(url)

  return new URL(`https://${canonicalizeHost(url.hostname)}/dp/${asin.toUpperCase()}`)
}

// Storefront variants collapse to www.<storefront>; any other subdomain is kept as is.
function canonicalizeHost(hostname: string): string {
  const storefront = STOREFRONT_HOST_REGEX.exec(hostname)?.[1]
  return storefront === undefined ? hostname : CANONICAL_HOST_PREFIX + storefront.toLowerCase()
}

function removeTrackingAndAffiliateParams(url: URL): URL {
  return removeQueryParams(normalizeUrlWithDefaults(url), AFFILIATE_PARAM_DENYLIST)
}

function buildAmazonAffiliateUrl(sourceUrl: string, associateTag: string): string {
  const affiliateUrl = normalizeAmazonUrl(new URL(sourceUrl))
  const tagSegment = `${ASSOCIATE_TAG_PARAM}=${encodeURIComponent(associateTag)}`
  affiliateUrl.search = [affiliateUrl.search.slice(1), tagSegment]
    .filter((segment) => segment.length > 0)
    .join(QUERY_SEPARATOR)
  return affiliateUrl.href
}
