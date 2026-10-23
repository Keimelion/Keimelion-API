import type { db as Db } from '../../client.js'
import { ItemStatuses } from '../../../shared/enums/item-status.js'
import { ITEM_IDS } from '../items/items.fixture.js'
import { LIST_IDS } from '../lists/lists.fixture.js'
import { listItems } from './list-items.schema.js'

interface ListItemFixture {
  id: string
  listId: string
  itemId: string
  quantityDesired: number
  creatorNote: string | null
  sortOrder: number | null
}

const LIST_ITEM_FIXTURES: readonly ListItemFixture[] = [
  // Mon anniversaire — covers quantity default, quantity>1, creator_note, sortOrder
  {
    id: '7d3f0b40-0005-4b60-8000-000000000001',
    listId: LIST_IDS.BIRTHDAY,
    itemId: ITEM_IDS.BIRTHDAY_BOOK,
    quantityDesired: 1,
    creatorNote: null,
    sortOrder: null,
  },
  {
    id: '7d3f0b40-0005-4b60-8000-000000000002',
    listId: LIST_IDS.BIRTHDAY,
    itemId: ITEM_IDS.BIRTHDAY_HEADPHONES,
    quantityDesired: 2,
    creatorNote: null,
    sortOrder: null,
  },
  {
    id: '7d3f0b40-0005-4b60-8000-000000000003',
    listId: LIST_IDS.BIRTHDAY,
    itemId: ITEM_IDS.BIRTHDAY_PLANT,
    quantityDesired: 1,
    creatorNote: 'Taille moyenne, dans un pot blanc si possible.',
    sortOrder: null,
  },
  {
    id: '7d3f0b40-0005-4b60-8000-000000000004',
    listId: LIST_IDS.BIRTHDAY,
    itemId: ITEM_IDS.BIRTHDAY_RUNNING_SHOES,
    quantityDesired: 1,
    creatorNote: null,
    sortOrder: 10,
  },
  // Crémaillère
  {
    id: '7d3f0b40-0005-4b60-8000-000000000005',
    listId: LIST_IDS.HOUSEWARMING,
    itemId: ITEM_IDS.HOUSEWARMING_COFFEE,
    quantityDesired: 1,
    creatorNote: null,
    sortOrder: null,
  },
  {
    id: '7d3f0b40-0005-4b60-8000-000000000006',
    listId: LIST_IDS.HOUSEWARMING,
    itemId: ITEM_IDS.HOUSEWARMING_LAMP,
    quantityDesired: 1,
    creatorNote: null,
    sortOrder: null,
  },
  // Liste de mariage — 5 items
  {
    id: '7d3f0b40-0005-4b60-8000-000000000007',
    listId: LIST_IDS.WEDDING,
    itemId: ITEM_IDS.WEDDING_DISHES,
    quantityDesired: 1,
    creatorNote: null,
    sortOrder: null,
  },
  {
    id: '7d3f0b40-0005-4b60-8000-000000000008',
    listId: LIST_IDS.WEDDING,
    itemId: ITEM_IDS.WEDDING_LINEN,
    quantityDesired: 1,
    creatorNote: null,
    sortOrder: null,
  },
  {
    id: '7d3f0b40-0005-4b60-8000-000000000009',
    listId: LIST_IDS.WEDDING,
    itemId: ITEM_IDS.WEDDING_VASE,
    quantityDesired: 3,
    creatorNote: 'Idéalement en deux ou trois exemplaires.',
    sortOrder: null,
  },
  {
    id: '7d3f0b40-0005-4b60-8000-00000000000a',
    listId: LIST_IDS.WEDDING,
    itemId: ITEM_IDS.WEDDING_WINE,
    quantityDesired: 1,
    creatorNote: null,
    sortOrder: null,
  },
  {
    id: '7d3f0b40-0005-4b60-8000-00000000000b',
    listId: LIST_IDS.WEDDING,
    itemId: ITEM_IDS.WEDDING_STAND_MIXER,
    quantityDesired: 1,
    creatorNote: null,
    sortOrder: 20,
  },
  // Soft-deleted list — items still linked, useful for RGPD export tests.
  {
    id: '7d3f0b40-0005-4b60-8000-00000000000c',
    listId: LIST_IDS.SOFT_DELETED,
    itemId: ITEM_IDS.DELETED_BOOK,
    quantityDesired: 1,
    creatorNote: null,
    sortOrder: null,
  },
]

export async function seedListItems(db: typeof Db): Promise<void> {
  const values = LIST_ITEM_FIXTURES.map((fixture) => ({
    id: fixture.id,
    listId: fixture.listId,
    itemId: fixture.itemId,
    quantityDesired: fixture.quantityDesired,
    creatorNote: fixture.creatorNote,
    sortOrder: fixture.sortOrder,
    itemStatus: ItemStatuses.AVAILABLE,
  }))

  const inserted = await db
    .insert(listItems)
    .values(values)
    .onConflictDoNothing({ target: listItems.id })
    .returning({ id: listItems.id })

  console.log(`  list_items       ${String(inserted.length)} rows`)
}
