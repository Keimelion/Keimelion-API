import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../config/env.js'
import * as schema from './entities/index.js'

const queryClient = postgres(env.DATABASE_URL)

export const db = drizzle(queryClient, { schema })

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
