export const CollabRoles = {
  OWNER: 'owner',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const

export type CollabRole = (typeof CollabRoles)[keyof typeof CollabRoles]

export const COLLAB_ROLE_VALUES = Object.values(CollabRoles) as [CollabRole, ...CollabRole[]]

export const CONTRIBUTOR_ROLE_VALUES = [CollabRoles.OWNER, CollabRoles.EDITOR] as const
