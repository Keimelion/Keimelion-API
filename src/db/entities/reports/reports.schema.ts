import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import {
  REPORT_REASON_VALUES,
  REPORT_STATUS_VALUES,
  REPORT_TARGET_TYPE_VALUES,
  ReportStatuses,
} from '@keimelion/sdk/enums'
import { REPORT_ADMIN_NOTE_MAX_LENGTH, REPORT_DESCRIPTION_MAX_LENGTH } from '@keimelion/sdk/schemas'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { users } from '../users/users.schema.js'
import { images } from '../images/images.schema.js'

export const reportTargetTypeEnum = pgEnum('report_target_type', REPORT_TARGET_TYPE_VALUES)
export const reportReasonEnum = pgEnum('report_reason', REPORT_REASON_VALUES)
export const reportStatusEnum = pgEnum('report_status', REPORT_STATUS_VALUES)

export const reports = pgTable(
  'reports',
  {
    id: uuidPrimaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: reportTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    targetSnapshot: jsonb('target_snapshot').$type<Record<string, unknown>>().notNull(),
    targetImageId: uuid('target_image_id').references(() => images.id, { onDelete: 'set null' }),
    reason: reportReasonEnum('reason').notNull(),
    description: text('description'),
    reportStatus: reportStatusEnum('report_status').notNull().default(ReportStatuses.PENDING),
    adminNote: text('admin_note'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index('reports_report_status_created_at_idx').on(table.reportStatus, table.createdAt),
    index('reports_target_type_target_id_idx').on(table.targetType, table.targetId),
    index('reports_user_id_idx').on(table.userId),
    index('reports_target_image_id_idx').on(table.targetImageId),
    check(
      'reports_description_length_check',
      sql`char_length(${table.description}) <= ${sql.raw(String(REPORT_DESCRIPTION_MAX_LENGTH))}`,
    ),
    check(
      'reports_admin_note_length_check',
      sql`char_length(${table.adminNote}) <= ${sql.raw(String(REPORT_ADMIN_NOTE_MAX_LENGTH))}`,
    ),
  ],
)

export type Report = typeof reports.$inferSelect
