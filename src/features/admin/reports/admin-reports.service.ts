import { ErrorCode, HttpStatus } from '@keimelion/sdk/enums'
import type { AdminReportsUpdateRequestParsed, PaginatedResponse } from '@keimelion/sdk/schemas'
import { buildPaginatedResponse } from '../../../shared/utils/pagination.js'
import { serviceError } from '../../../shared/utils/response.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { logger } from '../../../shared/utils/logger.js'
import { AdminAction } from '../admin.enums.js'
import { countReports, findAllReports, findReportById, updateReport } from './admin-reports.repository.js'
import { toAdminReport } from './admin-reports.mapper.js'
import type { UpdateReportFields } from './admin-reports.repository.js'
import type { AdminReport, ReportRowWithReporter } from './admin-reports.mapper.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { ListReportsInput } from './endpoints/list.js'

export async function listReports(
  input: ListReportsInput,
): Promise<ServiceResult<PaginatedResponse<AdminReport>>> {
  const [rows, total] = await Promise.all([findAllReports(input, input), countReports(input)])
  return {
    data: buildPaginatedResponse(rows.map(toAdminReport), input, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function getReport(id: string): Promise<ServiceResult<{ report: AdminReport }>> {
  const row = await findReportById(id)
  if (!row) return serviceError(ErrorCode.REPORT_NOT_FOUND)
  return { data: { report: toAdminReport(row) }, httpStatus: HttpStatus.OK }
}

export async function updateReportById(
  adminId: string,
  id: string,
  input: AdminReportsUpdateRequestParsed,
): Promise<ServiceResult<{ report: AdminReport }>> {
  const patch = pickDefined(input)
  if (Object.keys(patch).length === 0) return serviceError(ErrorCode.NO_FIELDS_TO_UPDATE)
  const existing = await findReportById(id)
  if (!existing) return serviceError(ErrorCode.REPORT_NOT_FOUND)
  const fields = buildReportUpdateFields(adminId, existing, patch)
  if (Object.keys(fields).length === 0) {
    return { data: { report: toAdminReport(existing) }, httpStatus: HttpStatus.OK }
  }
  const updated = await updateReport(id, fields)
  if (!updated) return serviceError(ErrorCode.INTERNAL_ERROR)
  logger.info({
    adminId,
    action: AdminAction.UPDATE_REPORT,
    reportId: id,
    changedFields: Object.keys(fields),
    status: { from: existing.reportStatus, to: updated.reportStatus },
  })
  return { data: { report: toAdminReport({ ...updated, reporter: existing.reporter }) }, httpStatus: HttpStatus.OK }
}

function buildReportUpdateFields(
  adminId: string,
  existing: ReportRowWithReporter,
  patch: Partial<AdminReportsUpdateRequestParsed>,
): UpdateReportFields {
  const fields: UpdateReportFields = {}
  if (patch.adminNote !== undefined && patch.adminNote !== existing.adminNote) fields.adminNote = patch.adminNote
  if (patch.status === undefined || patch.status === existing.reportStatus) return fields
  return { ...fields, reportStatus: patch.status, reviewedByUserId: adminId, reviewedAt: new Date() }
}
