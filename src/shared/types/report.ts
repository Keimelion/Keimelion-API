import type { ReportDetailParsed } from '@keimelion/sdk/schemas'
import type { Report } from '../../db/entities/reports/reports.schema.js'

export type ReportDetail = ReportDetailParsed

export function toReportDetail(row: Report): ReportDetail {
  return {
    id: row.id,
    userId: row.userId,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    description: row.description,
    status: row.reportStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
