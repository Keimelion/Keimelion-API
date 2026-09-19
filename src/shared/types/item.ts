export interface BaseItem {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  locale: string
  createdByUserId: string | null
  moderationStatus: string
  addCount: number
  reserveCount: number
  createdAt: Date
  updatedAt: Date
}

export interface BaseItemSource {
  id: string
  itemId: string
  shopName: string | null
  sourceUrl: string | null
  price: string | null
  currency: string
  affiliatePartner: string | null
  affiliateUrl: string | null
  isDomainTrusted: boolean
  isPrimary: boolean
  addedVia: string | null
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
