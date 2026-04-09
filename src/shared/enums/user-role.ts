export const USER_ROLE_VALUES = ['user', 'moderator', 'admin'] as const
export type UserRole = (typeof USER_ROLE_VALUES)[number]

export const UserRoles = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
} as const satisfies Record<string, UserRole>
