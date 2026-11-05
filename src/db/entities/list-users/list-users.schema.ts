import { sql } from 'drizzle-orm'
import { index, pgEnum, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { LIST_USER_ROLE_VALUES, ListUserRoles } from '@keimelion/sdk/enums'
import { lists } from '../lists/lists.schema.js'
import { users } from '../users/users.schema.js'

export const listUserRoleEnum = pgEnum('list_user_role', LIST_USER_ROLE_VALUES)

// Interpolated via sql.raw so renaming ListUserRoles.EDITOR breaks the build.
const EDITOR_ROLE_LITERAL = sql.raw(`'${ListUserRoles.EDITOR}'`)

export const listUsers = pgTable(
  'list_users',
  {
    id: uuidPrimaryKey(),
    listId: uuid('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: listUserRoleEnum('role').notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('uniq_list_users_list_user').on(table.listId, table.userId),
    uniqueIndex('uniq_list_users_active_editor')
      .on(table.listId)
      .where(sql`${table.role} = ${EDITOR_ROLE_LITERAL}`),
    index('idx_list_users_user_role').on(table.userId, table.role),
    index('idx_list_users_list_role').on(table.listId, table.role),
  ],
)

export type ListUser = typeof listUsers.$inferSelect
