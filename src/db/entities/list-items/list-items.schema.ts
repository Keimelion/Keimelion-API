import { integer, pgTable, smallint, text, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { lists } from '../lists/lists.schema.js'
import { items } from '../items/items.schema.js'

export const listItems = pgTable(
  'list_items',
  {
    id: uuidPrimaryKey(),
    listId: uuid('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'restrict' }),
    quantityDesired: smallint('quantity_desired').notNull().default(1),
    quantityReservedTotal: smallint('quantity_reserved_total').notNull().default(0),
    itemStatus: varchar('item_status', { length: 20 }).notNull().default('available'),
    sortOrder: integer('sort_order'),
    creatorNote: text('creator_note'),
    ...timestamps(),
  },
  (table) => [
    unique('list_items_list_id_item_id_unique').on(table.listId, table.itemId),
  ],
)

export type ListItem = typeof listItems.$inferSelect
