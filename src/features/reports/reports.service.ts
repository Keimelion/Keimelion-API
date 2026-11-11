import { ErrorCode, HttpStatus, ReportTargetTypes } from '@keimelion/sdk/enums'
import type { ReportTargetType } from '@keimelion/sdk/enums'
import type { ReportsCreateRequestParsed } from '@keimelion/sdk/schemas'
import { serviceError } from '../../shared/utils/response.js'
import { toReportDetail } from '../../shared/types/report.js'
import type { ReportDetail } from '../../shared/types/report.js'
import type { ServiceResult } from '../../shared/types/service.js'
import {
  findItemByIdWithSources,
  findListWithOwner,
  findUserByIdWithAvatar,
  insertReport,
} from './reports.repository.js'
import { toItemSnapshot, toListSnapshot, toUserSnapshot } from './reports.mapper.js'
import type { ReportTargetSnapshot } from './reports.mapper.js'

interface ReportTarget {
  snapshot: ReportTargetSnapshot
  imageId: string | null
}

export async function createReport(
  userId: string,
  input: ReportsCreateRequestParsed,
): Promise<ServiceResult<{ report: ReportDetail }>> {
  const target = await findReportTarget(input.targetType, input.targetId)
  if (!target) return serviceError(ErrorCode.REPORT_TARGET_NOT_FOUND)
  const row = await insertReport({
    userId,
    targetType: input.targetType,
    targetId: input.targetId,
    targetSnapshot: target.snapshot,
    targetImageId: target.imageId,
    reason: input.reason,
    description: input.description,
  })
  if (!row) return serviceError(ErrorCode.INTERNAL_ERROR)
  return { data: { report: toReportDetail(row) }, httpStatus: HttpStatus.CREATED }
}

function findReportTarget(targetType: ReportTargetType, targetId: string): Promise<ReportTarget | null> {
  switch (targetType) {
    case ReportTargetTypes.USER:
      return findUserTarget(targetId)
    case ReportTargetTypes.LIST:
      return findListTarget(targetId)
    case ReportTargetTypes.ITEM:
      return findItemTarget(targetId)
  }
}

async function findUserTarget(userId: string): Promise<ReportTarget | null> {
  const user = await findUserByIdWithAvatar(userId)
  if (!user || user.deletedAt) return null
  return { snapshot: toUserSnapshot(user), imageId: user.avatarImageId }
}

async function findListTarget(listId: string): Promise<ReportTarget | null> {
  const list = await findListWithOwner(listId, { excludeDeleted: true })
  if (!list) return null
  return { snapshot: toListSnapshot(list), imageId: null }
}

async function findItemTarget(itemId: string): Promise<ReportTarget | null> {
  const item = await findItemByIdWithSources(itemId)
  if (!item) return null
  return { snapshot: toItemSnapshot(item), imageId: item.imageId }
}
