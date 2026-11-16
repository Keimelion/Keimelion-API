import { resolveShopUrlStrategy } from './affiliate.registry.js'

const AFFILIATE_URL_PROTOCOL = 'https:'

export interface SourceUrlFields {
  sourceUrl: string | null
  originalUrl: string | null
  affiliateUrl: null
}

export interface SubmittedSourceUrlFields extends SourceUrlFields {
  sourceUrl: string
  originalUrl: string
}

// The affiliate URL is reset on every URL write: the generation job rebuilds it out of band.
export function buildSourceUrlFields(
  submittedUrl: string,
  shopSlug: string | null,
): SubmittedSourceUrlFields
export function buildSourceUrlFields(
  submittedUrl: string | null,
  shopSlug: string | null,
): SourceUrlFields
export function buildSourceUrlFields(
  submittedUrl: string | null,
  shopSlug: string | null,
): SourceUrlFields {
  return {
    sourceUrl: submittedUrl === null ? null : normalizeSourceUrl(submittedUrl, shopSlug),
    originalUrl: submittedUrl,
    affiliateUrl: null,
  }
}

export function normalizeSourceUrl(sourceUrl: string, shopSlug: string | null): string {
  const { normalize } = resolveShopUrlStrategy(shopSlug)
  return normalize(new URL(sourceUrl)).href
}

export async function generateAffiliateUrl(
  sourceUrl: string,
  shopSlug: string,
): Promise<string | null> {
  const { buildAffiliateUrl } = resolveShopUrlStrategy(shopSlug)
  if (buildAffiliateUrl === null) return null

  const affiliateUrl = await buildAffiliateUrl(sourceUrl)
  if (affiliateUrl === null) return null
  if (!isHttpsUrl(affiliateUrl)) throw new Error('affiliate_url_not_https')
  return affiliateUrl
}

function isHttpsUrl(url: string): boolean {
  return URL.canParse(url) && new URL(url).protocol === AFFILIATE_URL_PROTOCOL
}
