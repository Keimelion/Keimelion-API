export interface BaseOccasionType {
  id: string
  slug: string
  emoji: string | null
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
