import { count, eq } from 'drizzle-orm'
import type { AnyColumn } from 'drizzle-orm'
import type { ADMIN_REPORTS_SORT_FIELDS } from '@keimelion/sdk/schemas'
import type { SQL } from 'drizzle-orm'
import { z } from 'zod'
import { REPORT_REASON_VALUES, REPORT_STATUS_VALUES, REPORT_TARGET_TYPE_VALUES } from '@keimelion/sdk/enums'
import type { PaginationQueryParsed, SortInput } from '@keimelion/sdk/schemas'
import { db } from '../../../db/client.js'
import { reports } from '../../../db/entities/reports/reports.schema.js'
import { getOffset } from '../../../shared/utils/pagination.js'
import { defineEntity } from '../../../shared/db/entity-descriptor.js'
import type { Report } from '../../../db/entities/reports/reports.schema.js'
import type { FilterInput } from '../../../shared/db/filter-parser.js'
import type { ReportRowWithReporter } from './admin-reports.mapper.js'

const uuidSchema = z.guid()

const REPORTER_COLUMNS = { columns: { id: true, username: true } } as const

export const reportEntity = defineEntity({
  sortable: {
    createdAt: reports.createdAt,
    updatedAt: reports.updatedAt,
    status:    reports.reportStatus,
  } satisfies Record<(typeof ADMIN_REPORTS_SORT_FIELDS)[number], AnyColumn>,
  defaultSort: [{ field: 'createdAt', direction: 'desc' }],
  filterable: {
    status:     { column: reports.reportStatus, operators: ['eq', 'in'], valueSchema: z.enum(REPORT_STATUS_VALUES) },
    targetType: { column: reports.targetType,   operators: ['eq', 'in'], valueSchema: z.enum(REPORT_TARGET_TYPE_VALUES) },
    targetId:   { column: reports.targetId,     operators: ['eq'],       valueSchema: uuidSchema },
    reason:     { column: reports.reason,       operators: ['eq', 'in'], valueSchema: z.enum(REPORT_REASON_VALUES) },
    userId:     { column: reports.userId,       operators: ['eq', 'isNull'], valueSchema: uuidSchema },
    createdAt:  { column: reports.createdAt,    operators: ['gte', 'lte', 'between'], valueType: 'date' },
  },
})

export type ReportSortField = keyof typeof reportEntity.sortable

export interface ListReportsFilters {
  sort?: SortInput<ReportSortField> | undefined
  genericFilters: FilterInput[]
}

export type UpdateReportFields = Partial<
  Pick<typeof reports.$inferInsert, 'reportStatus' | 'adminNote' | 'reviewedByUserId' | 'reviewedAt'>
>

export function findAllReports(
  input: PaginationQueryParsed,
  filters: ListReportsFilters,
): Promise<ReportRowWithReporter[]> {
  return db.query.reports.findMany({
    where: buildReportsWhere(filters),
    orderBy: reportEntity.buildOrderBy(filters.sort),
    with: { reporter: REPORTER_COLUMNS },
    limit: input.limit,
    offset: getOffset(input),
  })
}

export async function countReports(filters: ListReportsFilters): Promise<number> {
  const [row] = await db.select({ count: count() }).from(reports).where(buildReportsWhere(filters))
  return row?.count ?? 0
}

export function findReportById(id: string): Promise<ReportRowWithReporter | undefined> {
  return db.query.reports.findFirst({
    where: eq(reports.id, id),
    with: { reporter: REPORTER_COLUMNS },
  })
}

export async function updateReport(id: string, fields: UpdateReportFields): Promise<Report | undefined> {
  const [row] = await db.update(reports).set(fields).where(eq(reports.id, id)).returning()
  return row
}

function buildReportsWhere(filters: ListReportsFilters): SQL | undefined {
  if (filters.genericFilters.length === 0) return undefined
  return reportEntity.buildWhere(filters.genericFilters)
}
