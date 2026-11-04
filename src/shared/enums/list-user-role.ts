export const ListUserRoles = {
  OWNER: 'owner',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const

export type ListUserRole = (typeof ListUserRoles)[keyof typeof ListUserRoles]

export const LIST_USER_ROLE_VALUES = Object.values(ListUserRoles) as [ListUserRole, ...ListUserRole[]]

export const CONTRIBUTOR_ROLE_VALUES = [ListUserRoles.OWNER, ListUserRoles.EDITOR] as const
