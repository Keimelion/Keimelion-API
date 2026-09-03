import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../config/env.js'
import * as usersSchema from './entities/users/users.schema.js'
import * as accessTokensSchema from './entities/access-tokens/access-tokens.schema.js'
import * as userDeletionAuditSchema from './entities/user-deletion-audit/user-deletion-audit.schema.js'
import * as refreshTokensSchema from './entities/refresh-tokens/refresh-tokens.schema.js'

const queryClient = postgres(env.DATABASE_URL)

export const db = drizzle(queryClient, {
  schema: { ...usersSchema, ...accessTokensSchema, ...userDeletionAuditSchema, ...refreshTokensSchema },
})
