export const UserRoles = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
} as const

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles]

export const USER_ROLE_VALUES = Object.values(UserRoles) as [UserRole, ...UserRole[]]
