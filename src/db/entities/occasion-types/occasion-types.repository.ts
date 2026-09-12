import { asc, eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { occasionTypes } from './occasion-types.schema.js'
import type { OccasionType } from './occasion-types.schema.js'

export function listActiveOccasionTypes(): Promise<OccasionType[]> {
  return db.query.occasionTypes.findMany({
    where: eq(occasionTypes.isActive, true),
    orderBy: asc(occasionTypes.sortOrder),
  })
}
