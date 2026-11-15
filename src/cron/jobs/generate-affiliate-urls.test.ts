import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../db/entities/item-sources/item-sources.repository.js', () => ({
  findPendingAffiliateSources: vi.fn(),
  storeAffiliateUrl: vi.fn(),
}))

vi.mock('../../db/entities/shops/shops.repository.js', () => ({
  lockShopIfAffiliated: vi.fn(),
}))

vi.mock('../../features/affiliate/affiliate.service.js', () => ({
  generateAffiliateUrl: vi.fn(),
}))

vi.mock('../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { env } from '../../config/env.js'
import { db } from '../../db/client.js'
import {
  findPendingAffiliateSources,
  storeAffiliateUrl,
} from '../../db/entities/item-sources/item-sources.repository.js'
import { lockShopIfAffiliated } from '../../db/entities/shops/shops.repository.js'
import { generateAffiliateUrl } from '../../features/affiliate/affiliate.service.js'
import { logger } from '../../shared/utils/logger.js'
import { affiliateUrlGeneration, generateAffiliateUrls } from './generate-affiliate-urls.js'

const SOURCE_BATCH_SIZE = 100
const SHOP_ID = '00000000-0000-0000-0000-0000000000a1'
const AFFILIATE_URL = 'https://www.amazon.fr/dp/B08N5WRWNW?tag=keimelion-21'

function pendingSource(index: number): {
  id: string
  shopId: string
  shopSlug: string
  sourceUrl: string
} {
  return {
    id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
    shopId: SHOP_ID,
    shopSlug: 'amazon',
    sourceUrl: 'https://www.amazon.fr/dp/B08N5WRWNW',
  }
}

const SOURCE = pendingSource(1)
const OTHER_SOURCE = pendingSource(2)

describe('generateAffiliateUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(lockShopIfAffiliated).mockResolvedValue(true)
    vi.mocked(storeAffiliateUrl).mockResolvedValue(true)
  })

  it('stores the generated affiliate URL of each pending source of an affiliated shop', async () => {
    vi.mocked(findPendingAffiliateSources).mockResolvedValueOnce([SOURCE])
    vi.mocked(generateAffiliateUrl).mockResolvedValueOnce(AFFILIATE_URL)

    await expect(generateAffiliateUrls()).resolves.toBe(1)

    expect(findPendingAffiliateSources).toHaveBeenCalledExactlyOnceWith({
      shopSlugs: ['amazon'],
      afterId: null,
      limit: SOURCE_BATCH_SIZE,
    })
    expect(generateAffiliateUrl).toHaveBeenCalledWith(SOURCE.sourceUrl, SOURCE.shopSlug)
    expect(lockShopIfAffiliated).toHaveBeenCalledWith(SHOP_ID, db)
    expect(storeAffiliateUrl).toHaveBeenCalledWith(SOURCE, AFFILIATE_URL, db)
  })

  it('writes nothing when the strategy generates no affiliate URL', async () => {
    vi.mocked(findPendingAffiliateSources).mockResolvedValueOnce([SOURCE])
    vi.mocked(generateAffiliateUrl).mockResolvedValueOnce(null)

    await expect(generateAffiliateUrls()).resolves.toBe(0)

    expect(storeAffiliateUrl).not.toHaveBeenCalled()
  })

  it('leaves a failed source NULL, keeps going and retries it on the next pass', async () => {
    vi.mocked(findPendingAffiliateSources)
      .mockResolvedValueOnce([SOURCE, OTHER_SOURCE])
      .mockResolvedValueOnce([SOURCE])
    vi.mocked(generateAffiliateUrl)
      .mockRejectedValueOnce(new Error('provider down'))
      .mockResolvedValueOnce(AFFILIATE_URL)
      .mockResolvedValueOnce(AFFILIATE_URL)

    await expect(generateAffiliateUrls()).resolves.toBe(1)
    expect(storeAffiliateUrl).toHaveBeenCalledExactlyOnceWith(OTHER_SOURCE, AFFILIATE_URL, db)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: SOURCE.id, shopSlug: SOURCE.shopSlug }),
      'Affiliate URL generation failed',
    )

    await expect(generateAffiliateUrls()).resolves.toBe(1)
    expect(storeAffiliateUrl).toHaveBeenLastCalledWith(SOURCE, AFFILIATE_URL, db)
  })

  it('re-checks the shop under lock and does not write once it is no longer affiliated', async () => {
    vi.mocked(findPendingAffiliateSources).mockResolvedValueOnce([SOURCE])
    vi.mocked(generateAffiliateUrl).mockResolvedValueOnce(AFFILIATE_URL)
    vi.mocked(lockShopIfAffiliated).mockResolvedValueOnce(false)

    await expect(generateAffiliateUrls()).resolves.toBe(0)

    expect(vi.mocked(db.transaction)).toHaveBeenCalledOnce()
    expect(storeAffiliateUrl).not.toHaveBeenCalled()
  })

  it('does not count a source whose URL or shop changed while its link was generated', async () => {
    vi.mocked(findPendingAffiliateSources).mockResolvedValueOnce([SOURCE])
    vi.mocked(generateAffiliateUrl).mockResolvedValueOnce(AFFILIATE_URL)
    vi.mocked(storeAffiliateUrl).mockResolvedValueOnce(false)

    await expect(generateAffiliateUrls()).resolves.toBe(0)
  })

  it('walks every batch of pending sources after the last processed id', async () => {
    const fullBatch = Array.from({ length: SOURCE_BATCH_SIZE }, (_, index) =>
      pendingSource(index + 1),
    )
    const lastSourceOfFirstBatch = fullBatch.at(-1)
    vi.mocked(findPendingAffiliateSources)
      .mockResolvedValueOnce(fullBatch)
      .mockResolvedValueOnce([OTHER_SOURCE])
    vi.mocked(generateAffiliateUrl).mockResolvedValue(AFFILIATE_URL)

    await expect(generateAffiliateUrls()).resolves.toBe(SOURCE_BATCH_SIZE + 1)

    expect(findPendingAffiliateSources).toHaveBeenCalledTimes(2)
    expect(findPendingAffiliateSources).toHaveBeenLastCalledWith({
      shopSlugs: ['amazon'],
      afterId: lastSourceOfFirstBatch?.id,
      limit: SOURCE_BATCH_SIZE,
    })
  })
})

describe('affiliate-url-generation cron job', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    affiliateUrlGeneration.stop()
    vi.useRealTimers()
  })

  it('does not run at startup', () => {
    affiliateUrlGeneration.start()

    expect(findPendingAffiliateSources).not.toHaveBeenCalled()
  })

  it('runs a pass on every interval', async () => {
    vi.mocked(findPendingAffiliateSources).mockResolvedValueOnce([])

    affiliateUrlGeneration.start()
    await vi.advanceTimersByTimeAsync(env.AFFILIATE_URL_GENERATION_INTERVAL_MS)

    expect(findPendingAffiliateSources).toHaveBeenCalledOnce()
    expect(logger.info).toHaveBeenCalledWith(
      { processedCount: 0 },
      'Affiliate URL generation completed',
    )
  })
})
