/** Orígenes y rutas de retorno de autenticación. Sin secretos. */

export const CANONICAL_SITE_ORIGIN = "https://www.migarra.app"

/** Destino relativo seguro tras login/OAuth. Evita open redirects. */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback
  const path = value.trim()
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\") || path.includes("\\") || path.includes("://")) {
    return fallback
  }
  try {
    const resolved = new URL(path, CANONICAL_SITE_ORIGIN)
    if (resolved.origin !== CANONICAL_SITE_ORIGIN) return fallback
    return `${resolved.pathname}${resolved.search}${resolved.hash}` || fallback
  } catch {
    return fallback
  }
}

/** Origen canónico en producción. No se fía de la cabecera Host. */
export function appAuthOrigin(): string {
  const configured = process.env.SITE_URL?.replace(/\/+$/, "")
  if (configured) return configured
  if (process.env.NODE_ENV === "development") return "http://localhost:3000"
  return CANONICAL_SITE_ORIGIN
}

export function googleCallbackUrl(next?: string | null): string {
  const dest = safeNextPath(next)
  const url = new URL("/auth/callback", appAuthOrigin())
  url.searchParams.set("flow", "google")
  url.searchParams.set("next", dest)
  return url.toString()
}

export function googleProviderEnabledFromSettings(settings: unknown): boolean {
  if (!settings || typeof settings !== "object") return false
  const external = (settings as { external?: unknown }).external
  if (!external || typeof external !== "object") return false
  return (external as { google?: unknown }).google === true
}
