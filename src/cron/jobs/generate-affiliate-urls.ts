import { env } from '../../config/env.js'
import { db } from '../../db/client.js'
import {
  findPendingAffiliateSources,
  storeAffiliateUrl,
} from '../../db/entities/item-sources/item-sources.repository.js'
import type { PendingAffiliateSource } from '../../db/entities/item-sources/item-sources.repository.js'
import { lockShopIfAffiliated } from '../../db/entities/shops/shops.repository.js'
import { AFFILIATE_SHOP_SLUGS } from '../../features/affiliate/affiliate.registry.js'
import { generateAffiliateUrl } from '../../features/affiliate/affiliate.service.js'
import { logger } from '../../shared/utils/logger.js'
import { createCronJob } from '../create-cron-job.js'

const JOB_NAME = 'Affiliate URL generation'
const SOURCE_BATCH_SIZE = 100

// Fills item_sources.affiliate_url for the sources of affiliated shops whose strategy builds links.
// A source whose generation fails or returns nothing keeps a NULL affiliate_url and is retried next pass.
export async function generateAffiliateUrls(): Promise<number> {
  if (AFFILIATE_SHOP_SLUGS.length === 0) return 0

  let storedCount = 0
  let afterId: string | null = null
  for (;;) {
    const batch = await findPendingAffiliateSources({
      shopSlugs: AFFILIATE_SHOP_SLUGS,
      afterId,
      limit: SOURCE_BATCH_SIZE,
    })
    for (const source of batch) {
      if (await generateAndStoreAffiliateUrl(source)) storedCount++
    }
    const lastSource = batch.at(-1)
    if (batch.length < SOURCE_BATCH_SIZE || lastSource === undefined) return storedCount
    afterId = lastSource.id
  }
}

async function generateAndStoreAffiliateUrl(source: PendingAffiliateSource): Promise<boolean> {
  try {
    const affiliateUrl = await generateAffiliateUrl(source.sourceUrl, source.shopSlug)
    if (affiliateUrl === null) return false
    return await storeIfShopStillAffiliated(source, affiliateUrl)
  } catch (error: unknown) {
    logger.warn(
      { error, job: JOB_NAME, sourceId: source.id, shopSlug: source.shopSlug },
      'Affiliate URL generation failed',
    )
    return false
  }
}

// The shared lock on the shop waits for an in-flight de-affiliation, so a link cleared with the flag is
// never written back.
function storeIfShopStillAffiliated(
  source: PendingAffiliateSource,
  affiliateUrl: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (!(await lockShopIfAffiliated(source.shopId, tx))) return false
    return storeAffiliateUrl(source, affiliateUrl, tx)
  })
}

export const affiliateUrlGeneration = createCronJob({
  name: JOB_NAME,
  intervalMs: env.AFFILIATE_URL_GENERATION_INTERVAL_MS,
  run: generateAffiliateUrls,
})
