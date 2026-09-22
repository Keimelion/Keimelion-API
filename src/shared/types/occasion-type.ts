export interface OccasionTypeDetail {
  id: string
  slug: string
  emoji: string | null
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface OccasionTypeWrite {
  slug: string
  emoji: string | null
  sortOrder: number
  isActive: boolean
}
