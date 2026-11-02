export const ItemStatuses = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  PURCHASED: 'purchased',
} as const

export type ItemStatus = (typeof ItemStatuses)[keyof typeof ItemStatuses]

export const ITEM_STATUS_VALUES = Object.values(ItemStatuses) as [ItemStatus, ...ItemStatus[]]
