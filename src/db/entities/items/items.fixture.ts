import type { db as Db } from '../../client.js'
import { items } from './items.schema.js'

/**
 * Deterministic UUIDs for dev-seeded items so dependent fixtures
 * (item_sources, list_items, item_tags, item_categories) can reference them
 * without a natural-key lookup, and reruns stay idempotent via PK conflict.
 */
export const ITEM_IDS = {
  BIRTHDAY_BOOK: '7d3f0b40-0003-4b60-8000-000000000001',
  BIRTHDAY_HEADPHONES: '7d3f0b40-0003-4b60-8000-000000000002',
  BIRTHDAY_PLANT: '7d3f0b40-0003-4b60-8000-000000000003',
  BIRTHDAY_RUNNING_SHOES: '7d3f0b40-0003-4b60-8000-000000000004',
  HOUSEWARMING_COFFEE: '7d3f0b40-0003-4b60-8000-000000000005',
  HOUSEWARMING_LAMP: '7d3f0b40-0003-4b60-8000-000000000006',
  WEDDING_DISHES: '7d3f0b40-0003-4b60-8000-000000000007',
  WEDDING_LINEN: '7d3f0b40-0003-4b60-8000-000000000008',
  WEDDING_VASE: '7d3f0b40-0003-4b60-8000-000000000009',
  WEDDING_WINE: '7d3f0b40-0003-4b60-8000-00000000000a',
  WEDDING_STAND_MIXER: '7d3f0b40-0003-4b60-8000-00000000000b',
  DELETED_BOOK: '7d3f0b40-0003-4b60-8000-00000000000c',
} as const

interface ItemFixture {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  createdByEmail: string
}

const ITEM_FIXTURES: readonly ItemFixture[] = [
  {
    id: ITEM_IDS.BIRTHDAY_BOOK,
    name: 'Livre de poche',
    description: null,
    imageUrl: null,
    createdByEmail: 'user@example.com',
  },
  {
    id: ITEM_IDS.BIRTHDAY_HEADPHONES,
    name: 'Casque Bluetooth',
    description: 'Casque sans fil haute fidélité, réduction de bruit active.',
    imageUrl: 'https://cdn.example.com/dev/headphones.jpg',
    createdByEmail: 'user@example.com',
  },
  {
    id: ITEM_IDS.BIRTHDAY_PLANT,
    name: 'Plante verte',
    description: 'Monstera deliciosa pour décorer le salon.',
    imageUrl: 'https://cdn.example.com/dev/plant.jpg',
    createdByEmail: 'user@example.com',
  },
  {
    id: ITEM_IDS.BIRTHDAY_RUNNING_SHOES,
    name: 'Chaussures de running',
    description: 'Pointure 42, pour entraînements sur route.',
    imageUrl: 'https://cdn.example.com/dev/running-shoes.jpg',
    createdByEmail: 'user@example.com',
  },
  {
    id: ITEM_IDS.HOUSEWARMING_COFFEE,
    name: 'Machine à café',
    description: 'Machine à expresso avec broyeur intégré.',
    imageUrl: 'https://cdn.example.com/dev/coffee-machine.jpg',
    createdByEmail: 'user@example.com',
  },
  {
    id: ITEM_IDS.HOUSEWARMING_LAMP,
    name: 'Lampe design',
    description: null,
    imageUrl: 'https://cdn.example.com/dev/lamp.jpg',
    createdByEmail: 'user@example.com',
  },
  {
    id: ITEM_IDS.WEDDING_DISHES,
    name: 'Service de table',
    description: 'Service de table pour 12 personnes, porcelaine blanche.',
    imageUrl: 'https://cdn.example.com/dev/dishes.jpg',
    createdByEmail: 'moderator@example.com',
  },
  {
    id: ITEM_IDS.WEDDING_LINEN,
    name: 'Linge de maison',
    description: 'Draps et serviettes en lin lavé.',
    imageUrl: 'https://cdn.example.com/dev/linen.jpg',
    createdByEmail: 'moderator@example.com',
  },
  {
    id: ITEM_IDS.WEDDING_VASE,
    name: 'Vase artisanal',
    description: 'Vase en céramique fait main.',
    imageUrl: 'https://cdn.example.com/dev/vase.jpg',
    createdByEmail: 'moderator@example.com',
  },
  {
    id: ITEM_IDS.WEDDING_WINE,
    name: 'Vin de Bordeaux',
    description: 'Caisse de 6 bouteilles de Saint-Émilion.',
    imageUrl: 'https://cdn.example.com/dev/wine.jpg',
    createdByEmail: 'moderator@example.com',
  },
  {
    id: ITEM_IDS.WEDDING_STAND_MIXER,
    name: 'Robot pâtissier',
    description: null,
    imageUrl: null,
    createdByEmail: 'moderator@example.com',
  },
  {
    id: ITEM_IDS.DELETED_BOOK,
    name: 'Vieux livre',
    description: null,
    imageUrl: null,
    createdByEmail: 'user@example.com',
  },
]

export async function seedItems(db: typeof Db): Promise<void> {
  const userRows = await db.query.users.findMany({ columns: { id: true, email: true } })
  const userIdByEmail = new Map(userRows.map((row) => [row.email, row.id]))

  const values = ITEM_FIXTURES.flatMap((fixture) => {
    const createdByUserId = userIdByEmail.get(fixture.createdByEmail) ?? null
    return [
      {
        id: fixture.id,
        name: fixture.name,
        description: fixture.description,
        imageUrl: fixture.imageUrl,
        createdByUserId,
      },
    ]
  })

  const inserted = await db
    .insert(items)
    .values(values)
    .onConflictDoNothing({ target: items.id })
    .returning({ id: items.id })

  console.log(`  items            ${String(inserted.length)} rows`)
}
