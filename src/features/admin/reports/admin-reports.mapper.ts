import type { AdminReportDetailParsed } from '@keimelion/sdk/schemas'
import type { Report } from '../../../db/entities/reports/reports.schema.js'
import type { User } from '../../../db/entities/users/users.schema.js'
import { toReportDetail } from '../../../shared/types/report.js'

export type AdminReport = AdminReportDetailParsed

export interface ReportRowWithReporter extends Report {
  reporter: Pick<User, 'id' | 'username'> | null
}

export function toAdminReport(row: ReportRowWithReporter): AdminReport {
  return {
    ...toReportDetail(row),
    reporter: row.reporter ? { id: row.reporter.id, username: row.reporter.username } : null,
    targetSnapshot: row.targetSnapshot,
    targetImageId: row.targetImageId,
    adminNote: row.adminNote,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt,
  }
}
