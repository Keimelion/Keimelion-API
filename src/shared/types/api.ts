export interface ApiError {
  message: string
  code: string
  metadata: Record<string, unknown>
}

export type PartialWrite<T> = { [K in keyof T]?: T[K] | undefined }

export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
