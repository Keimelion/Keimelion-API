import { db } from '../../db/client.js'
import { sql } from 'drizzle-orm'
import { HttpStatus } from '../../shared/enums/http.js'
import pkg from '../../../package.json' with { type: 'json' }

const HealthStatus = {
  OK: 'ok',
  DEGRADED: 'degraded',
} as const

const DbStatus = {
  OK: 'ok',
  ERROR: 'error',
} as const

type HealthStatusValue = (typeof HealthStatus)[keyof typeof HealthStatus]
type DbStatusValue = (typeof DbStatus)[keyof typeof DbStatus]

export interface HealthResult {
  status: HealthStatusValue
  database: DbStatusValue
  timestamp: string
  version: string
}

export interface HealthCheckResult {
  data: HealthResult
  httpStatus: typeof HttpStatus.OK | typeof HttpStatus.INTERNAL_SERVER_ERROR
}

export async function checkHealth(): Promise<HealthCheckResult> {
  const { version } = pkg
  const timestamp = new Date().toISOString()

  try {
    await db.execute(sql`SELECT 1`)
    return {
      data: { status: HealthStatus.OK, database: DbStatus.OK, timestamp, version },
      httpStatus: HttpStatus.OK,
    }
  } catch {
    return {
      data: { status: HealthStatus.DEGRADED, database: DbStatus.ERROR, timestamp, version },
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    }
  }
}
