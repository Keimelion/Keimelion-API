import { db } from '../../../db/client.js'
import { HttpStatus } from '../../../shared/enums/http.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import { serviceError } from '../../../shared/utils/response.js'
import { logger } from '../../../shared/utils/logger.js'
import { pickDefined } from '../../../shared/utils/partial-update.js'
import { isPgUniqueViolation } from '../../../shared/db/pg-errors.js'
import { buildPaginatedResponse } from '../../../shared/schemas/pagination.js'
import {
  findOccasionTypeById,
  findAllOccasionTypes,
  countOccasionTypes,
  findTranslationsForOccasionType,
  findTranslationsForOccasionTypes,
  insertOccasionType,
  updateOccasionType,
  upsertOccasionTypeTranslation,
  deleteOccasionTypeTranslation,
  deleteOccasionType,
} from '../../../db/entities/occasion-types/occasion-types.repository.js'
import { toAdminOccasionType } from './admin-occasion-types.mapper.js'
import { AdminAction } from '../admin.enums.js'
import type { AdminOccasionType } from './admin-occasion-types.mapper.js'
import type { ServiceResult } from '../../../shared/types/service.js'
import type { PaginatedResponse } from '../../../shared/types/api.js'
import type { PaginationInput } from '../../../shared/schemas/pagination.js'
import type { OccasionTypeTranslation } from '../../../db/entities/occasion-types/occasion-types.schema.js'
import type { AdminCreateOccasionTypeInput } from './endpoints/create.js'
import type { AdminUpdateOccasionTypeInput } from './endpoints/update.js'

export async function createOccasionType(
  adminId: string,
  input: AdminCreateOccasionTypeInput,
): Promise<ServiceResult<{ occasionType: AdminOccasionType }>> {
  let createdRow: AdminOccasionType

  try {
    const row = await insertOccasionType(
      {
        slug: input.slug,
        emoji: input.emoji,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
      input.translations,
    )

    if (!row) {
      return serviceError(ErrorCode.INTERNAL_ERROR)
    }

    const translations = await findTranslationsForOccasionType(row.id)
    createdRow = toAdminOccasionType(row, translations)
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      return serviceError(ErrorCode.CONFLICT)
    }
    return serviceError(ErrorCode.INTERNAL_ERROR)
  }

  logger.info({
    adminId,
    action: AdminAction.CREATE_OCCASION_TYPE,
    occasionTypeId: createdRow.id,
    slug: createdRow.slug,
  })

  return { data: { occasionType: createdRow }, httpStatus: HttpStatus.CREATED }
}

export async function listOccasionTypes(
  input: PaginationInput,
): Promise<ServiceResult<PaginatedResponse<AdminOccasionType>>> {
  const [rows, total] = await Promise.all([findAllOccasionTypes(input), countOccasionTypes()])

  const translations = await findTranslationsForOccasionTypes(rows.map((row) => row.id))
  const translationsByOccasionType = new Map<string, OccasionTypeTranslation[]>()
  for (const translation of translations) {
    const list = translationsByOccasionType.get(translation.occasionTypeId) ?? []
    list.push(translation)
    translationsByOccasionType.set(translation.occasionTypeId, list)
  }

  const items = rows.map((row) =>
    toAdminOccasionType(row, translationsByOccasionType.get(row.id) ?? []),
  )

  return {
    data: buildPaginatedResponse(items, input, total),
    httpStatus: HttpStatus.OK,
  }
}

export async function updateOccasionTypeById(
  adminId: string,
  id: string,
  input: AdminUpdateOccasionTypeInput,
): Promise<ServiceResult<{ occasionType: AdminOccasionType }>> {
  const existingRow = await findOccasionTypeById(id)

  if (!existingRow) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  const fieldPatch = pickDefined({
    emoji: input.emoji,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  })

  const changes: Record<string, unknown> = {}

  await db.transaction(async (tx) => {
    if (Object.keys(fieldPatch).length > 0) {
      await updateOccasionType(id, fieldPatch, tx)
      for (const [key, value] of Object.entries(fieldPatch)) {
        changes[key] = { from: existingRow[key as keyof typeof existingRow], to: value }
      }
    }

    if (input.translations !== undefined) {
      for (const translation of input.translations) {
        if (translation.label === null) {
          await deleteOccasionTypeTranslation(id, translation.locale, tx)
        } else {
          await upsertOccasionTypeTranslation(id, translation.locale, translation.label, tx)
        }
      }
    }
  })

  const updatedRow = await findOccasionTypeById(id)

  if (!updatedRow) {
    return serviceError(ErrorCode.INTERNAL_ERROR)
  }

  const translations = await findTranslationsForOccasionType(id)

  logger.info({
    adminId,
    action: AdminAction.UPDATE_OCCASION_TYPE,
    occasionTypeId: id,
    slug: existingRow.slug,
    changes,
  })

  return { data: { occasionType: toAdminOccasionType(updatedRow, translations) }, httpStatus: HttpStatus.OK }
}

export async function deleteOccasionTypeById(
  adminId: string,
  id: string,
): Promise<ServiceResult<null>> {
  const existingRow = await findOccasionTypeById(id)

  if (!existingRow) {
    return serviceError(ErrorCode.NOT_FOUND)
  }

  await deleteOccasionType(id)

  logger.warn({
    adminId,
    action: AdminAction.DELETE_OCCASION_TYPE,
    occasionTypeId: id,
    slug: existingRow.slug,
  })

  return { data: null, httpStatus: HttpStatus.NO_CONTENT }
}
