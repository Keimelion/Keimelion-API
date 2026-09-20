export interface BaseItem {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  createdByUserId: string | null
  moderationStatus: string
  createdAt: Date
  updatedAt: Date
}

export interface BaseItemSource {
  id: string
  itemId: string
  shopId: string | null
  sourceUrl: string | null
  price: string | null
  currency: string
  isDomainTrusted: boolean
  isPrimary: boolean
  createdAt: Date
  updatedAt: Date
}

export interface BaseListItem {
  id: string
  listId: string
  itemId: string
  quantityDesired: number
  quantityReservedTotal: number
  itemStatus: string
  sortOrder: number | null
  creatorNote: string | null
  createdAt: Date
  updatedAt: Date
}
