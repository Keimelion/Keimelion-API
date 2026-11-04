import type { db as Db } from '../../client.js'
import { items } from './items.schema.js'

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
  createdByEmail: string
}

const ITEM_FIXTURES: readonly ItemFixture[] = [
  {
    id: ITEM_IDS.BIRTHDAY_BOOK,
    name: 'Paperback book',
    description: null,
    createdByEmail: 'user@example.com',
  },
  {
    id: ITEM_IDS.BIRTHDAY_HEADPHONES,
    name: 'Bluetooth headphones',
    description: 'Wireless hi-fi headphones with active noise cancellation.',
    createdByEmail: 'user@example.com',
  },
  {
    id: ITEM_IDS.BIRTHDAY_PLANT,
    name: 'Green plant',
    description: 'Monstera deliciosa to decorate the living room.',
    createdByEmail: 'user@example.com',
  },
  {
    id: ITEM_IDS.BIRTHDAY_RUNNING_SHOES,
    name: 'Running shoes',
    description: 'Size 42, for road training sessions.',
    createdByEmail: 'user@example.com',
  },
  {
    id: ITEM_IDS.HOUSEWARMING_COFFEE,
    name: 'Coffee machine',
    description: 'Espresso machine with built-in grinder.',
    createdByEmail: 'user@example.com',
  },
  {
    id: ITEM_IDS.HOUSEWARMING_LAMP,
    name: 'Designer lamp',
    description: null,
    createdByEmail: 'user@example.com',
  },
  {
    id: ITEM_IDS.WEDDING_DISHES,
    name: 'Dinnerware set',
    description: 'Dinnerware set for twelve, white porcelain.',
    createdByEmail: 'moderator@example.com',
  },
  {
    id: ITEM_IDS.WEDDING_LINEN,
    name: 'Household linen',
    description: 'Washed linen sheets and towels.',
    createdByEmail: 'moderator@example.com',
  },
  {
    id: ITEM_IDS.WEDDING_VASE,
    name: 'Artisan vase',
    description: 'Handmade ceramic vase.',
    createdByEmail: 'moderator@example.com',
  },
  {
    id: ITEM_IDS.WEDDING_WINE,
    name: 'Bordeaux wine',
    description: 'Case of six bottles of Saint-Émilion.',
    createdByEmail: 'moderator@example.com',
  },
  {
    id: ITEM_IDS.WEDDING_STAND_MIXER,
    name: 'Stand mixer',
    description: null,
    createdByEmail: 'moderator@example.com',
  },
  {
    id: ITEM_IDS.DELETED_BOOK,
    name: 'Old book',
    description: null,
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
