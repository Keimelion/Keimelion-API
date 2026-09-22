export interface ItemDetail {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  createdByUserId: string | null
  moderationStatus: string
  createdAt: Date
  updatedAt: Date
}

export interface ItemWrite {
  name: string
  description: string | null
  imageUrl: string | null
}

export interface ItemSourceDetail {
  id: string
  itemId: string
  shopId: string | null
  sourceUrl: string | null
  price: string | null
  currency: string
  isPrimary: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ListItemDetail {
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

export interface ListItemWrite {
  quantityDesired: number
  creatorNote: string | null
  sortOrder: number | null
}
