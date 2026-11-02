import { eq, ne } from 'drizzle-orm'
import { db } from '../../client.js'
import { currencies } from './currencies.schema.js'
import { SupportedCurrencies } from '../../../shared/enums/currency.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface CurrencyRateUpdate {
  code: string
  usdRate: string
  usdRateAsOf: Date
}

export function findAllNonUsdCurrencyCodes(): Promise<{ code: string }[]> {
  return db
    .select({ code: currencies.code })
    .from(currencies)
    .where(ne(currencies.code, SupportedCurrencies.USD))
}

export async function updateCurrencyRate(tx: DbTransaction, update: CurrencyRateUpdate): Promise<void> {
  await tx
    .update(currencies)
    .set({ usdRate: update.usdRate, usdRateAsOf: update.usdRateAsOf })
    .where(eq(currencies.code, update.code))
}
