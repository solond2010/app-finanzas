// Comparación en tiempo constante para no filtrar por temporización cuánto
// coincide la contraseña probada con la real. `a !== b` corta en el primer
// carácter distinto — en teoría permite adivinar la contraseña carácter a
// carácter midiendo la respuesta. Implementación manual (no crypto.timingSafeEqual)
// porque este módulo lo usa tanto middleware.ts (Edge Runtime, sin el módulo
// `crypto` de Node) como la ruta /api/login (Node).
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
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
