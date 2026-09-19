export const ListStatuses = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  DELETED: 'deleted',
} as const

export type ListStatus = (typeof ListStatuses)[keyof typeof ListStatuses]

export const LIST_STATUS_VALUES = Object.values(ListStatuses) as [ListStatus, ...ListStatus[]]
