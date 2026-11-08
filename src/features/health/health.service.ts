import { db } from '../../db/client.js'
import { sql } from 'drizzle-orm'
import { DatabaseHealthStatuses, HealthStatuses, HttpStatus } from '@keimelion/sdk/enums'
import type { HealthGetResponseParsed } from '@keimelion/sdk/schemas'
import pkg from '../../../package.json' with { type: 'json' }

export type HealthResult = HealthGetResponseParsed

export interface HealthCheckResult {
  data: HealthResult
  httpStatus: typeof HttpStatus.OK | typeof HttpStatus.INTERNAL_SERVER_ERROR
}

export async function checkHealth(): Promise<HealthCheckResult> {
  const { version } = pkg
  const timestamp = new Date()

  try {
    await db.execute(sql`SELECT 1`)
    return {
      data: { status: HealthStatuses.OK, database: DatabaseHealthStatuses.OK, timestamp, version },
      httpStatus: HttpStatus.OK,
    }
  } catch {
    return {
      data: { status: HealthStatuses.DEGRADED, database: DatabaseHealthStatuses.ERROR, timestamp, version },
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    }
  }
}
