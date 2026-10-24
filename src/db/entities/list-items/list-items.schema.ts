import { pgEnum, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import {
  nonNegativeCheck,
  nonNegativeInt,
  nonNegativeSmallInt,
} from '../../../shared/db/checks.js'
import { ITEM_STATUS_VALUES, ItemStatuses } from '../../../shared/enums/item-status.js'
import { lists } from '../lists/lists.schema.js'
import { items } from '../items/items.schema.js'
import { images } from '../images/images.schema.js'

export const itemStatusEnum = pgEnum('item_status', ITEM_STATUS_VALUES)

export const listItems = pgTable(
  'list_items',
  {
    id: uuidPrimaryKey(),
    listId: uuid('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'restrict' }),
    quantityDesired: nonNegativeSmallInt('quantity_desired').notNull().default(1),
    quantityReservedTotal: nonNegativeSmallInt('quantity_reserved_total').notNull().default(0),
    itemStatus: itemStatusEnum('item_status').notNull().default(ItemStatuses.AVAILABLE),
    sortOrder: nonNegativeInt('sort_order'),
    creatorNote: text('creator_note'),
    imageId: uuid('image_id').references(() => images.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (table) => [
    unique('list_items_list_id_item_id_unique').on(table.listId, table.itemId),
    nonNegativeCheck(table.quantityDesired),
    nonNegativeCheck(table.quantityReservedTotal),
    nonNegativeCheck(table.sortOrder, { nullable: true }),
  ],
)

export type ListItem = typeof listItems.$inferSelect
