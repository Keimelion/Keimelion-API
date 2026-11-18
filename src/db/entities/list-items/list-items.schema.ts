import { pgEnum, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import {
  httpsUrlCheck,
  nonEmptyCheck,
  nonEmptyVarchar,
  nonNegativeCheck,
  nonNegativeInt,
  nonNegativeSmallInt,
} from '../../../shared/db/checks.js'
import { ITEM_STATUS_VALUES, ItemStatuses } from '@keimelion/sdk/enums'
import { MAX_CUSTOM_NAME_LENGTH, MAX_SOURCE_URL_LENGTH } from '@keimelion/sdk/schemas'
import { lists } from '../lists/lists.schema.js'
import { items } from '../items/items.schema.js'

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
    customName: nonEmptyVarchar('custom_name', MAX_CUSTOM_NAME_LENGTH),
    customUrl: nonEmptyVarchar('custom_url', MAX_SOURCE_URL_LENGTH),
    ...timestamps(),
  },
  (table) => [
    unique('list_items_list_id_item_id_unique').on(table.listId, table.itemId),
    nonNegativeCheck(table.quantityDesired),
    nonNegativeCheck(table.quantityReservedTotal),
    nonNegativeCheck(table.sortOrder, { nullable: true }),
    nonEmptyCheck(table.customName),
    nonEmptyCheck(table.customUrl),
    httpsUrlCheck(table.customUrl),
  ],
)

export type ListItem = typeof listItems.$inferSelect
