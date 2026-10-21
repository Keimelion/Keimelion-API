import { env } from '../../config/env.js'
import { db } from '../../db/client.js'
import {
  findAllNonUsdCurrencyCodes,
  updateCurrencyRate,
} from '../../db/entities/currencies/currencies.repository.js'
import { SupportedCurrencies } from '../../shared/enums/currency.js'
import { logger } from '../../shared/utils/logger.js'
import { createCronJob } from '../create-cron-job.js'

const USD_RATE_DECIMALS = 8
const JOB_NAME = 'FX rates refresh'

interface EcbSnapshot {
  asOf: Date
  eurRatesByCode: Map<string, number>
}

export async function refreshFxRates(): Promise<number> {
  const snapshot = await fetchEcbSnapshot()
  if (!snapshot) return 0

  const usdPerEur = snapshot.eurRatesByCode.get(SupportedCurrencies.USD)
  if (usdPerEur === undefined || usdPerEur <= 0) {
    logger.error({ job: JOB_NAME }, 'FX provider did not return a USD rate; skipping update')
    return 0
  }

  const codes = await findAllNonUsdCurrencyCodes()
  const updates = buildCurrencyUpdates(codes, snapshot, usdPerEur)
  if (updates.length === 0) {
    logger.info({ job: JOB_NAME, asOf: snapshot.asOf.toISOString() }, 'FX refresh: no rows to update')
    return 0
  }

  await db.transaction(async (tx) => {
    for (const update of updates) await updateCurrencyRate(tx, update)
  })

  logger.info(
    { job: JOB_NAME, updatedCount: updates.length, asOf: snapshot.asOf.toISOString(), provider: env.FX_PROVIDER_URL },
    'FX refresh: rates updated',
  )
  return updates.length
}

async function fetchEcbSnapshot(): Promise<EcbSnapshot | null> {
  try {
    const response = await fetch(env.FX_PROVIDER_URL)
    if (!response.ok) {
      logger.error(
        { job: JOB_NAME, status: response.status, provider: env.FX_PROVIDER_URL },
        'FX provider returned non-2xx; keeping previous rates',
      )
      return null
    }
    const xml = await response.text()
    return parseEcbXml(xml)
  } catch (error) {
    logger.error({ job: JOB_NAME, error, provider: env.FX_PROVIDER_URL }, 'FX provider fetch failed; keeping previous rates')
    return null
  }
}

export function parseEcbXml(xml: string): EcbSnapshot | null {
  const dateMatch = /<Cube\s+time=['"]([\d-]+)['"]/.exec(xml)
  if (!dateMatch?.[1]) {
    logger.error({ job: JOB_NAME }, 'FX provider payload missing time attribute; keeping previous rates')
    return null
  }
  const asOf = new Date(`${dateMatch[1]}T00:00:00Z`)
  if (Number.isNaN(asOf.getTime())) {
    logger.error({ job: JOB_NAME, raw: dateMatch[1] }, 'FX provider payload has invalid time; keeping previous rates')
    return null
  }

  const rateRegex = /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g
  const eurRatesByCode = new Map<string, number>()
  for (const match of xml.matchAll(rateRegex)) {
    const [, code, rawRate] = match
    if (!code || !rawRate) continue
    const parsed = Number.parseFloat(rawRate)
    if (!Number.isFinite(parsed) || parsed <= 0) continue
    eurRatesByCode.set(code, parsed)
  }

  if (eurRatesByCode.size === 0) {
    logger.error({ job: JOB_NAME }, 'FX provider payload contained no usable rates; keeping previous rates')
    return null
  }
  return { asOf, eurRatesByCode }
}

function buildCurrencyUpdates(
  codes: { code: string }[],
  snapshot: EcbSnapshot,
  usdPerEur: number,
): { code: string; usdRate: string; usdRateAsOf: Date }[] {
  return codes.flatMap(({ code }) => {
    const usdRate = computeUsdRate(code, snapshot, usdPerEur)
    if (usdRate === null) {
      logger.error({ job: JOB_NAME, code }, 'FX provider did not return a rate for currency; skipping row')
      return []
    }
    return [{ code, usdRate: usdRate.toFixed(USD_RATE_DECIMALS), usdRateAsOf: snapshot.asOf }]
  })
}

function computeUsdRate(code: string, snapshot: EcbSnapshot, usdPerEur: number): number | null {
  if (code === SupportedCurrencies.EUR) return 1 / usdPerEur
  const eurPerUnit = snapshot.eurRatesByCode.get(code)
  if (eurPerUnit === undefined) return null
  return eurPerUnit / usdPerEur
}

export const fxRatesRefresh = createCronJob({
  name: JOB_NAME,
  intervalMs: env.FX_REFRESH_INTERVAL_MS,
  run: refreshFxRates,
})
