// Auth de un solo secreto compartido (APP_PASSWORD). Sin usuarios individuales.
// Compatible con Edge (proxy.ts) y Node (/api/login): solo Web Crypto + JS puro.

export const AUTH_COOKIE_NAME = "app-auth"

// Mensaje fijo para derivar el token de sesión. No es un salt por usuario:
// con un único secreto compartido basta para que la cookie NO contenga la
// contraseña en claro. Cambiar APP_PASSWORD invalida todas las sesiones.
const SESSION_HMAC_MESSAGE = "finanzas-app-auth-v1"

// Comparación en tiempo constante para no filtrar por temporización cuánto
// coincide la contraseña/token probado con el real. `a !== b` corta en el
// primer carácter distinto. Implementación manual (no crypto.timingSafeEqual)
// porque este módulo lo usa tanto proxy.ts (Edge Runtime, sin el módulo
// `crypto` de Node) como la ruta /api/login (Node).
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Token opaco de sesión derivado de APP_PASSWORD (HMAC-SHA256). */
export async function createSessionToken(appPassword: string): Promise<string> {
  return hmacSha256Hex(appPassword, SESSION_HMAC_MESSAGE)
}

/** Valida la cookie app-auth contra el token esperado (timing-safe). */
export async function isValidSessionToken(
  cookieValue: string | undefined | null,
  appPassword: string,
): Promise<boolean> {
  if (!cookieValue) return false
  const expected = await createSessionToken(appPassword)
  return timingSafeEqualString(cookieValue, expected)
}

// Limitador de intentos de login en memoria: `MAX_ATTEMPTS` fallos por IP en
// `WINDOW_MS`. No es a prueba de balas — en Vercel cada invocación puede caer
// en una instancia serverless distinta con su propio estado, así que un
// atacante distribuido podría esquivarlo — pero sí frena el caso común de
// fuerza bruta desde una sola conexión, que es lo que hay hoy (ninguno).
const WINDOW_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 8
const attemptsByIp = new Map<string, { count: number; resetAt: number }>()

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now()
  const entry = attemptsByIp.get(ip)
  if (!entry || now > entry.resetAt) {
    attemptsByIp.set(ip, { count: 0, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { allowed: true }
}

export function recordFailedLogin(ip: string) {
  const now = Date.now()
  const entry = attemptsByIp.get(ip)
  if (!entry || now > entry.resetAt) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    entry.count++
  }
}

export function clearLoginAttempts(ip: string) {
  attemptsByIp.delete(ip)
}
