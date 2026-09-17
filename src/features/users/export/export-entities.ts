import type { BaseUser } from '../../../shared/types/user.js'
import { findUserById } from '../../../db/entities/users/users.repository.js'
import { toBaseUser } from '../users.mapper.js'

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
