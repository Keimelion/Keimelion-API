import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { ITEM_CONTRIBUTION_ACTION_VALUES } from '@keimelion/sdk/enums'
import type { ItemContributionChangesParsed } from '@keimelion/sdk/schemas'
import { uuidPrimaryKey } from '../../../shared/db/columns.js'
import { items } from '../items/items.schema.js'
import { users } from '../users/users.schema.js'

export const itemContributionActionEnum = pgEnum('item_contribution_action', ITEM_CONTRIBUTION_ACTION_VALUES)

// Append-only history: rows are never updated, so there is no updated_at column.
export const itemContributions = pgTable(
  'item_contributions',
  {
    id: uuidPrimaryKey(),
    itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: itemContributionActionEnum('action').notNull(),
    changes: jsonb('changes').$type<ItemContributionChangesParsed>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index('item_contributions_item_id_created_at_idx').on(table.itemId, table.createdAt.desc()),
    index('item_contributions_user_id_idx').on(table.userId),
    check('item_contributions_changes_not_empty_check', sql`${table.changes} <> '{}'::jsonb`),
  ],
)

export type ItemContribution = typeof itemContributions.$inferSelect
export type NewItemContribution = typeof itemContributions.$inferInsert
