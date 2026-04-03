export interface ApiError {
  message: string
  code: string
  metadata: Record<string, unknown>
}
