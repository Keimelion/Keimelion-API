import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../config/env.js'
import * as usersSchema from './entities/users/users.schema.js'
import * as activeTokensSchema from './entities/active-tokens/active-tokens.schema.js'

const queryClient = postgres(env.DATABASE_URL)

export const db = drizzle(queryClient, { schema: { ...usersSchema, ...activeTokensSchema } })
