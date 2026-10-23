import { inArray } from 'drizzle-orm'
import type { db as Db } from '../../client.js'
import { SupportedCurrencies } from '../../../shared/enums/currency.js'
import { shops } from '../shops/shops.schema.js'
import { ITEM_IDS } from '../items/items.fixture.js'
import { itemSources } from './item-sources.schema.js'
import type { SupportedCurrency } from '../../../shared/enums/currency.js'

type ItemSourceInsert = typeof itemSources.$inferInsert

interface ItemSourceFixture {
  id: string
  itemId: string
  shopSlug: string | null
  sourceUrl: string | null
  price: string
  currency: SupportedCurrency
}

const ITEM_SOURCE_FIXTURES: readonly ItemSourceFixture[] = [
  {
    id: '7d3f0b40-0004-4b60-8000-000000000001',
    itemId: ITEM_IDS.BIRTHDAY_PLANT,
    shopSlug: 'nature-et-decouvertes',
    sourceUrl: 'https://natureetdecouvertes.com/dev/plant',
    price: '24.50',
    currency: SupportedCurrencies.EUR,
  },
  {
    id: '7d3f0b40-0004-4b60-8000-000000000002',
    itemId: ITEM_IDS.BIRTHDAY_RUNNING_SHOES,
    shopSlug: 'decathlon',
    sourceUrl: 'https://decathlon.fr/dev/running-shoes',
    price: '89.00',
    currency: SupportedCurrencies.EUR,
  },
  {
    id: '7d3f0b40-0004-4b60-8000-000000000003',
    itemId: ITEM_IDS.HOUSEWARMING_COFFEE,
    shopSlug: 'fnac',
    sourceUrl: 'https://fnac.com/dev/coffee-machine',
    price: '149.00',
    currency: SupportedCurrencies.EUR,
  },
  {
    id: '7d3f0b40-0004-4b60-8000-000000000004',
    itemId: ITEM_IDS.HOUSEWARMING_LAMP,
    shopSlug: 'amazon',
    sourceUrl: 'https://amazon.fr/dev/lamp',
    price: '29.99',
    currency: SupportedCurrencies.USD,
  },
  {
    id: '7d3f0b40-0004-4b60-8000-000000000005',
    itemId: ITEM_IDS.WEDDING_DISHES,
    shopSlug: 'amazon',
    sourceUrl: 'https://amazon.fr/dev/dishes',
    price: '69.90',
    currency: SupportedCurrencies.EUR,
  },
  {
    id: '7d3f0b40-0004-4b60-8000-000000000006',
    itemId: ITEM_IDS.WEDDING_DISHES,
    shopSlug: 'fnac',
    sourceUrl: 'https://fnac.com/dev/dishes',
    price: '72.00',
    currency: SupportedCurrencies.EUR,
  },
  {
    id: '7d3f0b40-0004-4b60-8000-000000000007',
    itemId: ITEM_IDS.WEDDING_VASE,
    shopSlug: 'etsy',
    sourceUrl: 'https://etsy.com/dev/vase',
    price: '45.00',
    currency: SupportedCurrencies.EUR,
  },
  {
    id: '7d3f0b40-0004-4b60-8000-000000000008',
    itemId: ITEM_IDS.WEDDING_STAND_MIXER,
    shopSlug: 'amazon',
    sourceUrl: 'https://amazon.co.uk/dev/stand-mixer',
    price: '120.00',
    currency: SupportedCurrencies.GBP,
  },
  {
    id: '7d3f0b40-0004-4b60-8000-000000000009',
    itemId: ITEM_IDS.WEDDING_WINE,
    shopSlug: null,
    sourceUrl: 'https://example.com/dev/custom-wine-shop',
    price: '35.00',
    currency: SupportedCurrencies.EUR,
  },
]

export async function seedItemSources(db: typeof Db): Promise<void> {
  const slugs = Array.from(
    new Set(
      ITEM_SOURCE_FIXTURES.flatMap((fixture) => (fixture.shopSlug !== null ? [fixture.shopSlug] : [])),
    ),
  )
  const shopRows = await db.query.shops.findMany({
    where: inArray(shops.slug, slugs),
    columns: { id: true, slug: true },
  })
  const shopIdBySlug = new Map(shopRows.map((row) => [row.slug, row.id]))

  const values = ITEM_SOURCE_FIXTURES.flatMap<ItemSourceInsert>((fixture) => {
    if (fixture.shopSlug === null) {
      return [
        {
          id: fixture.id,
          itemId: fixture.itemId,
          shopId: null,
          sourceUrl: fixture.sourceUrl,
          price: fixture.price,
          currency: fixture.currency,
        },
      ]
    }
    const shopId = shopIdBySlug.get(fixture.shopSlug)
    if (!shopId) return []
    return [
      {
        id: fixture.id,
        itemId: fixture.itemId,
        shopId,
        sourceUrl: fixture.sourceUrl,
        price: fixture.price,
        currency: fixture.currency,
      },
    ]
  })

  if (values.length === 0) {
    console.log(`  item_sources     0 rows`)
    return
  }

  const inserted = await db
    .insert(itemSources)
    .values(values)
    .onConflictDoNothing({ target: itemSources.id })
    .returning({ id: itemSources.id })

  console.log(`  item_sources     ${String(inserted.length)} rows`)
}
