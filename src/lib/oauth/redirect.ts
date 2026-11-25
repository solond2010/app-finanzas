/** Solo se aceptan redirect_uri https o http en localhost/loopback. */

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1"
}

export function isAllowedRedirectUri(value: string): boolean {
  if (typeof value !== "string" || value.length > 2048) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.username || url.password || !url.hostname) return false
  if (url.protocol === "https:") return true
  if (url.protocol === "http:" && isLoopbackHost(url.hostname)) return true
  return false
}

export function sameRedirectUri(left: string, right: string): boolean {
  return left === right
}

export function parseRedirectUris(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) return null
  const uris: string[] = []
  for (const item of value) {
    if (typeof item !== "string" || !isAllowedRedirectUri(item)) return null
    uris.push(item)
  }
  return uris
}
