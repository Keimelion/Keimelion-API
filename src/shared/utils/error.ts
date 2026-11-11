// Logs must never carry an error message: driver and provider messages can embed personal data
// (query params, addresses). The name alone is safe to log.
export function readErrorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error
}
