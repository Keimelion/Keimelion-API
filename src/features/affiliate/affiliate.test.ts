import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AFFILIATE_SHOP_SLUGS, resolveShopUrlStrategy } from './affiliate.registry.js'
import {
  buildSourceUrlFields,
  generateAffiliateUrl,
  normalizeSourceUrl,
} from './affiliate.service.js'
import {
  AMAZON_SHOP_SLUG,
  amazonUrlStrategy,
  createAmazonUrlStrategy,
} from './strategies/amazon.strategy.js'
import { normalizeUrlWithDefaults } from './strategies/default.strategy.js'

const UNKNOWN_SHOP_SLUG = 'decathlon'
const ASSOCIATE_TAG = 'keimelion-21'

describe('default URL normalization', () => {
  it('strips utm_*, gclid, fbclid and the fragment', () => {
    const url = 'https://shop.example/p?utm_source=a&UTM_Medium=b&gclid=c&fbclid=d&id=42#reviews'

    expect(normalizeSourceUrl(url, null)).toBe('https://shop.example/p?id=42')
  })

  it('keeps every other parameter with its original encoding, so product variants survive', () => {
    const url = 'https://shop.example/p?color=red&size=M,L&ref=home&q=a%20b&utm_campaign=x'

    expect(normalizeSourceUrl(url, null)).toBe(
      'https://shop.example/p?color=red&size=M,L&ref=home&q=a%20b',
    )
  })

  it('drops the query string separator when only tracking parameters were present', () => {
    expect(normalizeSourceUrl('https://shop.example/p?utm_source=a#top', null)).toBe(
      'https://shop.example/p',
    )
  })

  it('leaves an already clean URL unchanged', () => {
    expect(normalizeSourceUrl('https://shop.example/p/123?variant=2', null)).toBe(
      'https://shop.example/p/123?variant=2',
    )
  })

  it('applies to a shop without a registered strategy', () => {
    expect(
      normalizeSourceUrl('https://decathlon.fr/p?utm_source=a&size=42', UNKNOWN_SHOP_SLUG),
    ).toBe('https://decathlon.fr/p?size=42')
  })

  it('does not mutate the URL it receives', () => {
    const url = new URL('https://shop.example/p?gclid=1#top')

    normalizeUrlWithDefaults(url)

    expect(url.href).toBe('https://shop.example/p?gclid=1#top')
  })
})

describe('Amazon URL strategy', () => {
  it.each([
    [
      'https://www.amazon.fr/Lampe-Design/dp/B08N5WRWNW/ref=sr_1_1?keywords=lampe&th=1',
      'https://www.amazon.fr/dp/B08N5WRWNW',
    ],
    ['https://amazon.fr/gp/product/b08n5wrwnw?psc=1', 'https://www.amazon.fr/dp/B08N5WRWNW'],
    ['https://m.amazon.co.uk/gp/aw/d/B08N5WRWNW', 'https://www.amazon.co.uk/dp/B08N5WRWNW'],
    [
      'https://smile.amazon.com/dp/B08N5WRWNW?tag=someone-20',
      'https://www.amazon.com/dp/B08N5WRWNW',
    ],
    ['https://www.amazon.com.br/dp/B08N5WRWNW', 'https://www.amazon.com.br/dp/B08N5WRWNW'],
    ['https://music.amazon.fr/dp/B08N5WRWNW?ref=x', 'https://music.amazon.fr/dp/B08N5WRWNW'],
  ])('reduces product page %s to its canonical /dp/<ASIN> URL', (url, expected) => {
    expect(normalizeSourceUrl(url, AMAZON_SHOP_SLUG)).toBe(expected)
  })

  it('takes precedence over the default normalization', () => {
    const url = 'https://www.amazon.fr/dp/B08N5WRWNW?th=1'

    expect(normalizeSourceUrl(url, null)).toBe(url)
    expect(normalizeSourceUrl(url, AMAZON_SHOP_SLUG)).toBe('https://www.amazon.fr/dp/B08N5WRWNW')
  })

  it('removes a third-party affiliate tag from a non-product page and keeps its other parameters', () => {
    const url =
      'https://www.amazon.fr/s?k=lampe&tag=someone-21&ascsubtag=x&linkCode=ll2&utm_source=y#top'

    expect(normalizeSourceUrl(url, AMAZON_SHOP_SLUG)).toBe('https://www.amazon.fr/s?k=lampe')
  })

  it.each([undefined, ''])(
    'exposes no affiliate URL builder when the associate tag is %j, so the job skips Amazon',
    (associateTag) => {
      const strategy = createAmazonUrlStrategy({ associateTag })

      expect(strategy.buildAffiliateUrl).toBeUndefined()
      expect(strategy.normalize).toBeDefined()
    },
  )

  it('appends the configured associate tag to the normalized URL', async () => {
    const strategy = createAmazonUrlStrategy({ associateTag: ASSOCIATE_TAG })

    await expect(strategy.buildAffiliateUrl?.('https://www.amazon.fr/dp/B08N5WRWNW')).resolves.toBe(
      `https://www.amazon.fr/dp/B08N5WRWNW?tag=${ASSOCIATE_TAG}`,
    )
  })

  it('replaces a third-party tag still present on a source stored before normalization', async () => {
    const strategy = createAmazonUrlStrategy({ associateTag: ASSOCIATE_TAG })

    await expect(
      strategy.buildAffiliateUrl?.('https://www.amazon.fr/s?k=lampe&tag=someone-21'),
    ).resolves.toBe(`https://www.amazon.fr/s?k=lampe&tag=${ASSOCIATE_TAG}`)
  })
})

describe('strategy registry', () => {
  it('lists the shops whose strategy can build affiliate URLs', () => {
    expect(AFFILIATE_SHOP_SLUGS).toEqual([AMAZON_SHOP_SLUG])
  })

  it('resolves the default strategy, without affiliate URLs, for an unknown or missing shop', () => {
    expect(resolveShopUrlStrategy(UNKNOWN_SHOP_SLUG)).toEqual({
      normalize: normalizeUrlWithDefaults,
      buildAffiliateUrl: null,
    })
    expect(resolveShopUrlStrategy(null)).toEqual({
      normalize: normalizeUrlWithDefaults,
      buildAffiliateUrl: null,
    })
  })
})

describe('buildSourceUrlFields', () => {
  it('stores the normalized URL, keeps the submitted one and resets the affiliate URL', () => {
    const submittedUrl = 'https://shop.example/p?utm_source=a&id=1'

    expect(buildSourceUrlFields(submittedUrl, null)).toEqual({
      sourceUrl: 'https://shop.example/p?id=1',
      originalUrl: submittedUrl,
      affiliateUrl: null,
    })
  })

  it('clears every URL column when the URL is removed', () => {
    expect(buildSourceUrlFields(null, AMAZON_SHOP_SLUG)).toEqual({
      sourceUrl: null,
      originalUrl: null,
      affiliateUrl: null,
    })
  })
})

describe('generateAffiliateUrl', () => {
  const SOURCE_URL = 'https://www.amazon.fr/dp/B08N5WRWNW'

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('generates no affiliate URL for a shop on the default strategy', async () => {
    await expect(
      generateAffiliateUrl('https://decathlon.fr/p', UNKNOWN_SHOP_SLUG),
    ).resolves.toBeNull()
  })

  it('builds the Amazon link with the configured associate tag', async () => {
    await expect(generateAffiliateUrl(SOURCE_URL, AMAZON_SHOP_SLUG)).resolves.toBe(
      `${SOURCE_URL}?tag=${ASSOCIATE_TAG}`,
    )
  })

  it('returns the URL built by the shop strategy', async () => {
    vi.spyOn(amazonUrlStrategy, 'buildAffiliateUrl').mockResolvedValueOnce(
      `${SOURCE_URL}?tag=${ASSOCIATE_TAG}`,
    )

    await expect(generateAffiliateUrl(SOURCE_URL, AMAZON_SHOP_SLUG)).resolves.toBe(
      `${SOURCE_URL}?tag=${ASSOCIATE_TAG}`,
    )
  })

  it('rejects a URL that is not HTTPS', async () => {
    vi.spyOn(amazonUrlStrategy, 'buildAffiliateUrl').mockResolvedValueOnce(
      'http://www.amazon.fr/dp/B08N5WRWNW',
    )

    await expect(generateAffiliateUrl(SOURCE_URL, AMAZON_SHOP_SLUG)).rejects.toThrow(
      'affiliate_url_not_https',
    )
  })

  it('propagates a strategy failure to the caller', async () => {
    vi.spyOn(amazonUrlStrategy, 'buildAffiliateUrl').mockRejectedValueOnce(
      new Error('provider down'),
    )

    await expect(generateAffiliateUrl(SOURCE_URL, AMAZON_SHOP_SLUG)).rejects.toThrow(
      'provider down',
    )
  })
})
