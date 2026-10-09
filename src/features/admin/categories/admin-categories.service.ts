import { db } from '../../../db/client.js'
import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { MAX_CATEGORY_DEPTH, serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import { isPgUniqueViolation } from '../../../shared/db/pg-errors.js'
import {
  findAllCategories,
  countCategories,
} from './admin-categories.repository.js'
import {
  deleteCategory,
  findCategoriesByParentId,
  findCategoriesByParentIds,
  findCategoryById,
  insertCategory,
  updateCategoryDepth,
  updateCategoryRow,
} from '../../../db/entities/categories/categories.repository.js'
import { AdminAction } from '../admin.enums.js'
import { toCategoryDetail } from '../../../shared/types/category.js'
import type { CategoryDetail } from '../../../shared/types/category.js'
import type { Category } from '../../../db/entities/categories/categories.schema.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { ListCategoriesInput } from './endpoints/list.js'
import type { CreateCategoryInput } from './endpoints/create.js'
import type { UpdateCategoryInput } from './endpoints/update.js'

const MAX_ALLOWED_DEPTH = MAX_CATEGORY_DEPTH - 1

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function createCategory(
  adminId: string,
  input: CreateCategoryInput,
): Promise<ServiceResult<{ category: CategoryDetail }>> {
  const depthResolution = await resolveDepthForNewParent(input.parentId)
  if ('errorCode' in depthResolution) return serviceError(depthResolution.errorCode)

  try {
    const row = await insertCategory({
      parentId: input.parentId,
      name: input.name,
      slug: input.slug,
      depth: depthResolution.depth,
    })
    if (!row) return serviceError(ErrorCode.INTERNAL_ERROR)

    const category = toCategoryDetail(row)
    logger.info({ adminId, action: AdminAction.CREATE_CATEGORY, categoryId: category.id, slug: category.slug })
    return { data: { category }, httpStatus: HttpStatus.CREATED }
  } catch (error) {
    if (isPgUniqueViolation(error)) return serviceError(ErrorCode.CATEGORY_SLUG_CONFLICT)
    throw error
  }
}

export async function listCategories(
  input: ListCategoriesInput,
): Promise<ServiceResult<PaginatedResponse<CategoryDetail>>> {
  const [rows, total] = await Promise.all([findAllCategories(input, input), countCategories(input)])

  return {
    data: buildPaginatedResponse(rows.map(toCategoryDetail), input, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function getCategoryById(
  id: string,
): Promise<ServiceResult<{ category: CategoryDetail }>> {
  const row = await findCategoryById(id)
  if (!row) return serviceError(ErrorCode.CATEGORY_NOT_FOUND)
  return { data: { category: toCategoryDetail(row) }, httpStatus: HttpStatus.OK }
}

export async function updateCategoryById(
  adminId: string,
  id: string,
  input: UpdateCategoryInput,
): Promise<ServiceResult<{ category: CategoryDetail }>> {
  const existing = await findCategoryById(id)
  if (!existing) return serviceError(ErrorCode.CATEGORY_NOT_FOUND)

  const nameSlugPatch = pickDefined({ name: input.name, slug: input.slug })

  if (input.parentId === undefined) {
    if (Object.keys(nameSlugPatch).length === 0) {
      return { data: { category: toCategoryDetail(existing) }, httpStatus: HttpStatus.OK }
    }
    return applySimplePatch(id, nameSlugPatch)
  }

  return applyParentChange(adminId, existing, input.parentId, nameSlugPatch)
}

export async function deleteCategoryById(
  adminId: string,
  id: string,
): Promise<ServiceResult<null>> {
  const existing = await findCategoryById(id)
  if (!existing) return serviceError(ErrorCode.CATEGORY_NOT_FOUND)

  await deleteCategory(id)
  logger.warn({ adminId, action: AdminAction.DELETE_CATEGORY, categoryId: id, slug: existing.slug })
  return { data: null, httpStatus: HttpStatus.NO_CONTENT }
}

interface DepthResolutionSuccess {
  depth: number
}
interface DepthResolutionFailure {
  errorCode: ErrorCode
}

async function resolveDepthForNewParent(
  parentId: string | null,
): Promise<DepthResolutionSuccess | DepthResolutionFailure> {
  if (parentId === null) return { depth: 0 }
  const parent = await findCategoryById(parentId)
  if (!parent) return { errorCode: ErrorCode.CATEGORY_NOT_FOUND }
  const depth = parent.depth + 1
  if (depth > MAX_ALLOWED_DEPTH) return { errorCode: ErrorCode.CATEGORY_MAX_DEPTH_EXCEEDED }
  return { depth }
}

async function applySimplePatch(
  id: string,
  patch: { name?: string; slug?: string },
): Promise<ServiceResult<{ category: CategoryDetail }>> {
  try {
    const row = await updateCategoryRow(id, patch)
    if (!row) return serviceError(ErrorCode.CATEGORY_NOT_FOUND)
    return { data: { category: toCategoryDetail(row) }, httpStatus: HttpStatus.OK }
  } catch (error) {
    if (isPgUniqueViolation(error)) return serviceError(ErrorCode.CATEGORY_SLUG_CONFLICT)
    throw error
  }
}

async function applyParentChange(
  adminId: string,
  existing: Category,
  newParentId: string | null,
  nameSlugPatch: { name?: string; slug?: string },
): Promise<ServiceResult<{ category: CategoryDetail }>> {
  if (newParentId === existing.id) return serviceError(ErrorCode.CATEGORY_CYCLE_DETECTED)

  const resolution = await resolveParentChange(existing, newParentId)
  if ('errorCode' in resolution) return serviceError(resolution.errorCode)

  try {
    const row = await db.transaction(async (tx) =>
      applyParentChangeInTransaction(tx, existing, resolution, newParentId, nameSlugPatch),
    )
    if (!row) return serviceError(ErrorCode.INTERNAL_ERROR)

    logger.info({
      adminId,
      action: AdminAction.UPDATE_CATEGORY,
      categoryId: existing.id,
      slug: existing.slug,
      changes: { parentId: { from: existing.parentId, to: newParentId } },
    })
    return { data: { category: toCategoryDetail(row) }, httpStatus: HttpStatus.OK }
  } catch (error) {
    if (isPgUniqueViolation(error)) return serviceError(ErrorCode.CATEGORY_SLUG_CONFLICT)
    throw error
  }
}

interface ParentChangeResolution {
  newDepth: number
  offset: number
  descendants: Category[]
}

async function resolveParentChange(
  existing: Category,
  newParentId: string | null,
): Promise<ParentChangeResolution | DepthResolutionFailure> {
  let newDepth = 0
  if (newParentId !== null) {
    const parent = await findCategoryById(newParentId)
    if (!parent) return { errorCode: ErrorCode.CATEGORY_NOT_FOUND }
    const cycleFound = await walkAncestorsHasId(parent, existing.id)
    if (cycleFound) return { errorCode: ErrorCode.CATEGORY_CYCLE_DETECTED }
    newDepth = parent.depth + 1
  }

  if (newDepth > MAX_ALLOWED_DEPTH) {
    return { errorCode: ErrorCode.CATEGORY_MAX_DEPTH_EXCEEDED }
  }

  const descendants = await loadDescendants(existing.id)
  const offset = newDepth - existing.depth
  const subtreeMaxDepth = descendants.reduce(
    (acc, node) => Math.max(acc, node.depth),
    existing.depth,
  )
  if (subtreeMaxDepth + offset > MAX_ALLOWED_DEPTH) {
    return { errorCode: ErrorCode.CATEGORY_MAX_DEPTH_EXCEEDED }
  }

  return { newDepth, offset, descendants }
}

async function applyParentChangeInTransaction(
  tx: DbTransaction,
  existing: Category,
  resolution: ParentChangeResolution,
  newParentId: string | null,
  nameSlugPatch: { name?: string; slug?: string },
): Promise<Category | undefined> {
  const row = await updateCategoryRow(
    existing.id,
    { ...nameSlugPatch, parentId: newParentId, depth: resolution.newDepth },
    tx,
  )
  if (!row) return undefined

  if (resolution.offset !== 0) {
    await Promise.all(
      resolution.descendants.map((descendant) =>
        updateCategoryDepth(descendant.id, descendant.depth + resolution.offset, tx),
      ),
    )
  }

  return row
}

async function walkAncestorsHasId(start: Category, targetId: string): Promise<boolean> {
  let current: Category | undefined = start
  while (current) {
    if (current.id === targetId) return true
    if (current.parentId === null) return false
    current = await findCategoryById(current.parentId)
  }
  return false
}

async function loadDescendants(rootId: string): Promise<Category[]> {
  const children = await findCategoriesByParentId(rootId)
  if (children.length === 0) return []
  const grandchildren = await findCategoriesByParentIds(children.map((child) => child.id))
  return [...children, ...grandchildren]
}
