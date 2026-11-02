import type { db as Db } from '../../client.js'
import { shops } from './shops.schema.js'

const SHOP_FIXTURES = [
  { slug: 'amazon', name: 'Amazon', domain: 'amazon.fr', isAffiliated: true, sortOrder: 10 },
  { slug: 'fnac', name: 'Fnac', domain: 'fnac.com', isAffiliated: true, sortOrder: 20 },
  { slug: 'decathlon', name: 'Decathlon', domain: 'decathlon.fr', isAffiliated: false, sortOrder: 30 },
  {
    slug: 'nature-et-decouvertes',
    name: 'Nature & Découvertes',
    domain: 'natureetdecouvertes.com',
    isAffiliated: false,
    sortOrder: 40,
  },
  { slug: 'etsy', name: 'Etsy', domain: 'etsy.com', isAffiliated: true, sortOrder: 50 },
] as const

export async function seedShops(db: typeof Db): Promise<void> {
  const inserted = await db
    .insert(shops)
    .values(SHOP_FIXTURES.map((fixture) => ({ ...fixture })))
    .onConflictDoNothing({ target: shops.slug })
    .returning({ id: shops.id })

  console.log(`  shops            ${String(inserted.length)} rows`)
}
