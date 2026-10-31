// Claves personales para los Atajos de iPhone. En la base de datos solo se
// guarda el hash SHA-256 de la clave (nunca la clave en claro), así que ni
// quien lea la tabla puede usarlas. La clave completa se enseña UNA vez al
// crearla. Solo Web Crypto: funciona igual en Node, Edge y tests.

export const API_TOKEN_PREFIX = "fz_"

function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** Genera una clave nueva (32 bytes aleatorios) con prefijo reconocible. */
export function generateApiToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return API_TOKEN_PREFIX + toBase64Url(bytes)
}

export async function hashApiToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

/** Parte visible para reconocer la clave en la lista (no sirve para entrar). */
export function tokenDisplayPrefix(token: string): string {
  return token.slice(0, API_TOKEN_PREFIX.length + 6)
}

export function looksLikeApiToken(value: string): boolean {
  return value.startsWith(API_TOKEN_PREFIX) && value.length >= API_TOKEN_PREFIX.length + 20 && value.length <= 200
}
