export const ASCII_HOSTNAME_REGEX =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/

export function normalizeDomain(value: string): string {
  const lowered = value.toLowerCase()
  const withProtocol =
    lowered.startsWith('http://') || lowered.startsWith('https://') ? lowered : `https://${lowered}`

  let hostname: string
  try {
    hostname = new URL(withProtocol).hostname
  } catch {
    hostname = lowered
  }

  return hostname.replace(/\/$/, '').replace(/^www\./, '')
}
