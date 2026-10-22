import { count, eq, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/client.js'
import { feedback } from '../../../db/entities/feedback/feedback.schema.js'
import { FEEDBACK_STATUS_VALUES } from '../../../shared/enums/feedback-status.js'
import { defineEntity } from '../../../shared/db/entity-descriptor.js'
import { getOffset } from '../../../shared/schemas/pagination.js'
import type { Feedback } from '../../../db/entities/feedback/feedback.schema.js'
import type { FeedbackStatus } from '../../../shared/enums/feedback-status.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { SortInput } from '../../../shared/schemas/sort.js'
import type { FilterInput } from '../../../shared/db/filter-parser.js'
import type { FeedbackRowWithUser } from './admin-feedback.mapper.js'

const feedbackStatusSchema = z.enum(FEEDBACK_STATUS_VALUES)
const userIdSchema = z.string().uuid()

export const feedbackEntity = defineEntity({
  sortable: {
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt,
    status:    feedback.status,
  },
  defaultSort: [{ field: 'createdAt', direction: 'desc' }],
  filterable: {
    status:    { column: feedback.status,    operators: ['eq', 'in'], valueSchema: feedbackStatusSchema },
    userId:    { column: feedback.userId,    operators: ['eq', 'isNull'], valueSchema: userIdSchema },
    title:     { column: feedback.title,     operators: ['ilike'] },
    createdAt: { column: feedback.createdAt, operators: ['gte', 'lte', 'between'], valueType: 'date' },
  },
})

export type FeedbackSortField = keyof typeof feedbackEntity.sortable

export interface ListFeedbackFilters {
  sort?: SortInput<FeedbackSortField> | undefined
  genericFilters?: FilterInput[] | undefined
}

function buildFeedbackWhere(filters: ListFeedbackFilters): SQL | undefined {
  const generic = filters.genericFilters ?? []
  if (generic.length === 0) return undefined
  return feedbackEntity.buildWhere(generic)
}

export function findAllFeedback(
  input: PaginationInput,
  filters: ListFeedbackFilters,
): Promise<FeedbackRowWithUser[]> {
  const offset = getOffset(input)
  return db.query.feedback.findMany({
    where: buildFeedbackWhere(filters),
    orderBy: feedbackEntity.buildOrderBy(filters.sort),
    with: { user: { columns: { id: true, username: true, email: true } } },
    limit: input.limit,
    offset,
  })
}

export async function countFeedback(filters: ListFeedbackFilters): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(feedback)
    .where(buildFeedbackWhere(filters))
  return row?.count ?? 0
}

export function findFeedbackById(id: string): Promise<FeedbackRowWithUser | undefined> {
  return db.query.feedback.findFirst({
    where: eq(feedback.id, id),
    with: { user: { columns: { id: true, username: true, email: true } } },
  })
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
): Promise<Feedback | undefined> {
  const [row] = await db
    .update(feedback)
    .set({ status })
    .where(eq(feedback.id, id))
    .returning()
  return row
}
