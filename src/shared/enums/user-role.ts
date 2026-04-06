export const USER_ROLE_VALUES = ['user', 'moderator', 'admin'] as const
export type UserRole = (typeof USER_ROLE_VALUES)[number]
