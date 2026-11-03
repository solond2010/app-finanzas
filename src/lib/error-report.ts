// Avisos de error de Garra: limpieza compartida por navegador y servidor.
// Nunca se guardan datos financieros: los importes, emails, claves y
// números largos que aparezcan en un mensaje se tapan antes de enviarlo.

export type ErrorReport = {
  source: "navegador" | "servidor"
  route: string | null
  message: string
  stack: string | null
  digest: string | null
  userAgent: string | null
}

const LIMITS = { route: 300, message: 1000, stack: 4000, digest: 100, userAgent: 300 }

/** Tapa emails, claves, tokens e importes/números largos. */
export function scrubText(text: string): string {
  return text
    .replace(/[^\s@"'<>()]{1,64}@[^\s@"'<>()]{1,255}\.[a-z]{2,}/gi, "[email]")
    .replace(/\b(fz|sb|sk|pk|re)_[A-Za-z0-9_-]{8,}/g, "[clave]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[token]")
    .replace(/\b(Bearer|token|secret|password|contraseña)(\s*[:=]\s*|\s+)\S+/gi, "$1 [oculto]")
    // Importes con símbolo de moneda delante o detrás.
    .replace(/[€$£]\s?-?\d[\d.,]*|-?\d[\d.,]*\s?(€|EUR|USD|CHF|GBP|\$|£)/gi, "[importe]")
    // Números de 4+ cifras (con o sin separadores): saldos, IBAN, tarjetas.
    .replace(/-?\d[\d.,]{3,}\d/g, "[n]")
}

/** Ruta sin query ni hash (pueden llevar filtros o búsquedas del usuario). */
export function cleanRoute(route: string | null | undefined): string | null {
  if (!route) return null
  let path = String(route)
  try { path = new URL(path, "http://x").pathname } catch { /* se usa tal cual */ }
  return path.split(/[?#]/)[0].slice(0, LIMITS.route) || null
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

/** Normaliza y limpia un aviso antes de guardarlo. */
export function sanitizeErrorReport(input: Partial<Record<keyof ErrorReport, unknown>>, source: ErrorReport["source"]): ErrorReport {
  const message = clip(input.message, LIMITS.message * 2)
  const stack = clip(input.stack, LIMITS.stack * 2)
  return {
    source,
    route: cleanRoute(clip(input.route, 2000)),
    message: (message ? scrubText(message) : "Error sin mensaje").slice(0, LIMITS.message),
    stack: stack ? scrubText(stack).slice(0, LIMITS.stack) : null,
    digest: clip(input.digest, LIMITS.digest),
    userAgent: clip(input.userAgent, LIMITS.userAgent),
  }
}

/** Errores de navegador que no son fallos de Garra (extensiones, red, etc.). */
export function isIgnorableClientError(message: string): boolean {
  return /ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|safari-web-extension:|webkit-masked-url:|Load failed|Failed to fetch|NetworkError|AbortError|The operation was aborted|NEXT_REDIRECT|NEXT_NOT_FOUND/i.test(message) || isExtensionNoise(message)
}

/** Ruido de extensiones y navegadores dentro de apps (carteras cripto,
 * Firefox/Edge/Chrome en iOS, traductores, gestores de contraseñas…): no son
 * fallos de Garra. */
export function isExtensionNoise(message: string): boolean {
  return /window\.ethereum|ethereum\.|\bweb3\b|solana|phantom|__firefox__|__gCrWeb|__edgeTranslate|webkit\.messageHandlers|_AutofillCallbackHandler|instantSearchSDKJSBridge|zaloJSV2|feedly|grammarly|bitwarden|onepassword|1password|lastpass|dashlane|translate\.googleapis|Can't find variable: (?:__firefox__|gCrWeb|ethereum|_AutofillCallbackHandler|zaloJSV2)/i.test(message)
}

/** Límite simple en memoria: máximo `max` eventos por clave cada `windowMs`. */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>()
  return function allow(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
    if (recent.length >= max) { hits.set(key, recent); return false }
    recent.push(now)
    hits.set(key, recent)
    if (hits.size > 5000) hits.clear()
    return true
  }
}
