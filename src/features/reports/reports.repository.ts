import { db } from '../../db/client.js'
import { reports } from '../../db/entities/reports/reports.schema.js'
import type { Report } from '../../db/entities/reports/reports.schema.js'

export { findUserByIdWithAvatar } from '../../db/entities/users/users.repository.js'
export { findListWithOwner } from '../../db/entities/lists/lists.repository.js'
export { findItemByIdWithSources } from '../../db/entities/items/items.repository.js'

type InsertReportInput = Pick<
  typeof reports.$inferInsert,
  'userId' | 'targetType' | 'targetId' | 'targetSnapshot' | 'targetImageId' | 'reason' | 'description'
>

export async function insertReport(input: InsertReportInput): Promise<Report | undefined> {
  const [row] = await db.insert(reports).values(input).returning()
  return row
}
