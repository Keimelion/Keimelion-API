import { env } from '../../../config/env.js'
import type { ShopUrlStrategy } from '../affiliate.registry.js'
import { normalizeUrlWithDefaults, removeQueryParams } from './default.strategy.js'

export const AMAZON_SHOP_SLUG = 'amazon'

const ASIN_PATH_REGEX =
  /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin|o\/asin)\/([a-z0-9]{10})(?:[/?]|$)/i
const ALTERNATE_HOST_PREFIX_REGEX = /^(?:www|m|smile)\./
const CANONICAL_HOST_PREFIX = 'www.'
const AFFILIATE_PARAM_DENYLIST = /^(?:tag|ascsubtag|linkcode|linkid)$/i
const ASSOCIATE_TAG_PARAM = 'tag'
const QUERY_SEPARATOR = '&'

interface AmazonStrategyConfig {
  associateTag: string | undefined
}

export function createAmazonUrlStrategy(config: AmazonStrategyConfig): ShopUrlStrategy {
  return {
    normalize: normalizeAmazonUrl,
    buildAffiliateUrl: (sourceUrl) => Promise.resolve(buildAmazonAffiliateUrl(sourceUrl, config)),
  }
}

export const amazonUrlStrategy = createAmazonUrlStrategy({ associateTag: env.AMAZON_ASSOCIATE_TAG })

// Product pages collapse to /dp/<ASIN> so every variant of the same link shares one URL; other pages
// keep their path and only lose tracking and third-party affiliate parameters.
function normalizeAmazonUrl(url: URL): URL {
  const asin = ASIN_PATH_REGEX.exec(url.pathname)?.[1]
  if (asin === undefined) return removeTrackingAndAffiliateParams(url)

  const host = CANONICAL_HOST_PREFIX + url.hostname.replace(ALTERNATE_HOST_PREFIX_REGEX, '')
  return new URL(`https://${host}/dp/${asin.toUpperCase()}`)
}

function removeTrackingAndAffiliateParams(url: URL): URL {
  return removeQueryParams(normalizeUrlWithDefaults(url), AFFILIATE_PARAM_DENYLIST)
}

function buildAmazonAffiliateUrl(sourceUrl: string, config: AmazonStrategyConfig): string | null {
  if (!config.associateTag) return null

  const affiliateUrl = normalizeAmazonUrl(new URL(sourceUrl))
  const tagSegment = `${ASSOCIATE_TAG_PARAM}=${encodeURIComponent(config.associateTag)}`
  affiliateUrl.search = [affiliateUrl.search.slice(1), tagSegment]
    .filter((segment) => segment.length > 0)
    .join(QUERY_SEPARATOR)
  return affiliateUrl.href
}
