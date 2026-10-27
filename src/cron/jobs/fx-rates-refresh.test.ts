import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../db/entities/currencies/currencies.repository.js', () => ({
  findAllNonUsdCurrencyCodes: vi.fn(),
  updateCurrencyRate: vi.fn(),
}))

vi.mock('../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { env } from '../../config/env.js'
import { db } from '../../db/client.js'
import {
  findAllNonUsdCurrencyCodes,
  updateCurrencyRate,
} from '../../db/entities/currencies/currencies.repository.js'
import { logger } from '../../shared/utils/logger.js'
import { fxRatesRefresh, parseEcbXml, refreshFxRates } from './fx-rates-refresh.js'

const INTERVAL_MS = env.FX_REFRESH_INTERVAL_MS

const ECB_SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <Cube>
    <Cube time='2026-10-20'>
      <Cube currency='USD' rate='1.0800'/>
      <Cube currency='GBP' rate='0.8640'/>
      <Cube currency='CHF' rate='0.9504'/>
      <Cube currency='CAD' rate='1.4796'/>
      <Cube currency='AUD' rate='1.6416'/>
      <Cube currency='JPY' rate='161.4600'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`

const NON_USD_CODES = [
  { code: 'EUR' },
  { code: 'GBP' },
  { code: 'CHF' },
  { code: 'CAD' },
  { code: 'AUD' },
  { code: 'JPY' },
]

function mockFetchResponse(body: string, ok = true, status = 200): void {
  const fetchMock = vi.fn().mockResolvedValueOnce({
    ok,
    status,
    text: () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', fetchMock)
}

function mockFetchFailure(error: Error): void {
  const fetchMock = vi.fn().mockRejectedValueOnce(error)
  vi.stubGlobal('fetch', fetchMock)
}

describe('parseEcbXml', () => {
  it('extracts the asOf date and all currency rates', () => {
    const snapshot = parseEcbXml(ECB_SAMPLE_XML)

    expect(snapshot).not.toBeNull()
    expect(snapshot?.asOf.toISOString()).toBe('2026-10-20T00:00:00.000Z')
    expect(snapshot?.eurRatesByCode.get('USD')).toBeCloseTo(1.08)
    expect(snapshot?.eurRatesByCode.get('JPY')).toBeCloseTo(161.46)
  })

  it('returns null when the payload has no time attribute', () => {
    const snapshot = parseEcbXml('<Cube><Cube currency="USD" rate="1.08"/></Cube>')

    expect(snapshot).toBeNull()
    expect(vi.mocked(logger.error)).toHaveBeenCalled()
  })

  it('returns null when the payload contains no usable rates', () => {
    const snapshot = parseEcbXml("<Cube time='2026-10-20'></Cube>")

    expect(snapshot).toBeNull()
  })

  it('skips rate entries with non-finite or non-positive values', () => {
    const snapshot = parseEcbXml(
      "<Cube time='2026-10-20'><Cube currency='USD' rate='1.08'/><Cube currency='GBP' rate='0.00'/></Cube>",
    )

    expect(snapshot?.eurRatesByCode.has('USD')).toBe(true)
    expect(snapshot?.eurRatesByCode.has('GBP')).toBe(false)
  })
})

describe('refreshFxRates — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(findAllNonUsdCurrencyCodes).mockResolvedValue(NON_USD_CODES)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('updates every non-USD row with the pivoted USD rate and the parsed asOf date', async () => {
    mockFetchResponse(ECB_SAMPLE_XML)

    const updatedCount = await refreshFxRates()

    expect(updatedCount).toBe(NON_USD_CODES.length)
    expect(vi.mocked(db.transaction)).toHaveBeenCalledOnce()
    expect(vi.mocked(updateCurrencyRate)).toHaveBeenCalledTimes(NON_USD_CODES.length)

    const callsByCode = new Map(
      vi.mocked(updateCurrencyRate).mock.calls.map(([, update]) => [update.code, update]),
    )

    const asOf = new Date('2026-10-20T00:00:00.000Z')

    expect(callsByCode.get('EUR')?.usdRate).toBe((1 / 1.08).toFixed(8))
    expect(callsByCode.get('GBP')?.usdRate).toBe((0.864 / 1.08).toFixed(8))
    expect(callsByCode.get('JPY')?.usdRate).toBe((161.46 / 1.08).toFixed(8))
    expect(callsByCode.get('EUR')?.usdRateAsOf).toEqual(asOf)
  })

  it('never issues an update for USD (the anchor row)', async () => {
    mockFetchResponse(ECB_SAMPLE_XML)

    await refreshFxRates()

    const touchedCodes = vi.mocked(updateCurrencyRate).mock.calls.map(([, update]) => update.code)
    expect(touchedCodes).not.toContain('USD')
  })

  it('skips rows whose currency is not present in the provider payload (and logs)', async () => {
    const xmlWithoutJpy = ECB_SAMPLE_XML.replace(
      "<Cube currency='JPY' rate='161.4600'/>",
      '',
    )
    mockFetchResponse(xmlWithoutJpy)

    const updatedCount = await refreshFxRates()

    expect(updatedCount).toBe(NON_USD_CODES.length - 1)
    const touchedCodes = vi.mocked(updateCurrencyRate).mock.calls.map(([, update]) => update.code)
    expect(touchedCodes).not.toContain('JPY')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'JPY' }),
      expect.stringContaining('did not return a rate'),
    )
  })

  it('emits a success log line with updatedCount, asOf, and provider', async () => {
    mockFetchResponse(ECB_SAMPLE_XML)

    await refreshFxRates()

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({
        job: 'FX rates refresh',
        updatedCount: NON_USD_CODES.length,
        asOf: '2026-10-20T00:00:00.000Z',
        provider: env.FX_PROVIDER_URL,
      }),
      'FX refresh: rates updated',
    )
  })
})

describe('refreshFxRates — failure modes leave the DB untouched', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(findAllNonUsdCurrencyCodes).mockResolvedValue(NON_USD_CODES)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not open a transaction and returns 0 when the provider returns non-2xx', async () => {
    mockFetchResponse('<error/>', false, 503)

    const updatedCount = await refreshFxRates()

    expect(updatedCount).toBe(0)
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
    expect(vi.mocked(updateCurrencyRate)).not.toHaveBeenCalled()
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.objectContaining({ status: 503 }),
      expect.stringContaining('non-2xx'),
    )
  })

  it('does not open a transaction when the provider fetch throws', async () => {
    mockFetchFailure(new Error('network down'))

    const updatedCount = await refreshFxRates()

    expect(updatedCount).toBe(0)
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
    expect(vi.mocked(updateCurrencyRate)).not.toHaveBeenCalled()
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) as Error }),
      expect.stringContaining('fetch failed'),
    )
  })

  it('does not open a transaction when the provider payload is unparseable', async () => {
    mockFetchResponse('<not-ecb-xml/>')

    const updatedCount = await refreshFxRates()

    expect(updatedCount).toBe(0)
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
    expect(vi.mocked(updateCurrencyRate)).not.toHaveBeenCalled()
  })

  it('does not open a transaction when the provider payload omits USD', async () => {
    const xmlWithoutUsd = ECB_SAMPLE_XML.replace(
      "<Cube currency='USD' rate='1.0800'/>",
      '',
    )
    mockFetchResponse(xmlWithoutUsd)

    const updatedCount = await refreshFxRates()

    expect(updatedCount).toBe(0)
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'FX rates refresh' }),
      expect.stringContaining('did not return a USD rate'),
    )
  })
})

describe('fxRatesRefresh cron wrapper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.mocked(findAllNonUsdCurrencyCodes).mockResolvedValue([])
  })

  afterEach(() => {
    fxRatesRefresh.stop()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not run at startup', () => {
    fxRatesRefresh.start()
    expect(vi.mocked(findAllNonUsdCurrencyCodes)).not.toHaveBeenCalled()
  })

  it('runs after the interval elapses', async () => {
    mockFetchResponse(ECB_SAMPLE_XML)

    fxRatesRefresh.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(findAllNonUsdCurrencyCodes)).toHaveBeenCalledOnce()
  })

  it('stop cancels scheduled runs', async () => {
    fxRatesRefresh.start()
    fxRatesRefresh.stop()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3)

    expect(vi.mocked(findAllNonUsdCurrencyCodes)).not.toHaveBeenCalled()
  })
})
