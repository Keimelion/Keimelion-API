const BEARER_SCHEME_PREFIX = 'Bearer '

export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith(BEARER_SCHEME_PREFIX)) return null
  return authorizationHeader.slice(BEARER_SCHEME_PREFIX.length)
}
