import type { BaseUser } from '../../../shared/types/user.js'
import { findUserById } from '../../../db/entities/users/users.repository.js'
import { toBaseUser } from '../users.mapper.js'

/**
 * Descriptor for a single entity exported in the RGPD CSV archive.
 *
 * Extensibility contract (RGPD art. 20 — right to portability):
 * Adding a new user-linked table (direct FK `user_id` OR transitive, e.g.
 * `list_items` → `lists` → `users`) to the export requires exactly:
 *   1. Define a new `ExportEntityDescriptor` with:
 *      - `filename`: unique CSV filename inside the ZIP (e.g. `lists.csv`)
 *      - `columns`: explicit allow-list of column headers (NEVER spread a DB
 *        row — this guarantees no sensitive column leaks by accident)
 *      - `fetchRows`: async function that resolves to plain rows scoped to
 *        the given `userId`
 *   2. Append the descriptor to `EXPORT_ENTITY_REGISTRY` below
 *
 * Security invariants (do NOT relax):
 *   - Row mappers MUST filter sensitive fields (passwordHash, verify/reset
 *     tokens, refresh secrets, banReason, deletion audit internals…). Prefer
 *     going through a `toBaseX` mapper that already strips them.
 *   - `columns` is an allow-list — any key present in a row but absent from
 *     `columns` is silently dropped by csv-stringify.
 *   - Anti-formula-injection is enforced globally by `escape_formulas: true`
 *     in `csv-archive-writer.ts` — do NOT disable it per entity.
 */
export interface ExportEntityDescriptor {
  filename: string
  columns: string[]
  fetchRows: (userId: string) => Promise<Record<string, unknown>[]>
}

function baseUserToRow(user: BaseUser): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    authProvider: user.authProvider,
    role: user.role,
    avatarUrl: user.avatarUrl,
    isCgvAccepted: user.isCgvAccepted,
    cgvAcceptedAt: user.cgvAcceptedAt,
    isMarketingOptedIn: user.isMarketingOptedIn,
    emailVerifiedAt: user.emailVerifiedAt,
    lastActiveAt: user.lastActiveAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

const PROFILE_COLUMNS = [
  'id',
  'email',
  'username',
  'authProvider',
  'role',
  'avatarUrl',
  'isCgvAccepted',
  'cgvAcceptedAt',
  'isMarketingOptedIn',
  'emailVerifiedAt',
  'lastActiveAt',
  'createdAt',
  'updatedAt',
]

const profileEntityDescriptor: ExportEntityDescriptor = {
  filename: 'profile.csv',
  columns: PROFILE_COLUMNS,
  fetchRows: async (userId: string) => {
    const user = await findUserById(userId)
    if (!user) return []
    return [baseUserToRow(toBaseUser(user))]
  },
}

export const EXPORT_ENTITY_REGISTRY: ExportEntityDescriptor[] = [
  profileEntityDescriptor,
]
