import "server-only"
import { NextResponse } from "next/server"
import { checkLoginRateLimit, recordFailedLogin } from "@/lib/auth"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"

export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")
  return fwd?.split(",")[0]?.trim() || "unknown"
}

/** Dirección pública de la web para los enlaces de los emails. */
export function siteOrigin(request: Request): string {
  const configured = process.env.SITE_URL?.replace(/\/+$/, "")
  return configured || new URL(request.url).origin
}

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

/** Corta si el modo cuentas no está activo o si la IP ha fallado demasiado. */
export function guardAuthRequest(request: Request): NextResponse | null {
  if (!isSupabaseAuthEnabled()) return json({ error: "Las cuentas de usuario aún no están activadas" }, 404)
  const limit = checkLoginRateLimit(getClientIp(request))
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Inténtalo de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 300) } },
    )
  }
  return null
}

export function countFailure(request: Request) {
  recordFailedLogin(getClientIp(request))
}

/** Traduce los errores de Supabase Auth más comunes a mensajes claros. */
export function friendlyAuthError(message: string | undefined): string {
  // Sin datos del usuario: solo el texto de Supabase, para poder diagnosticar.
  if (message) console.warn("[auth]", message)
  const m = (message ?? "").toLowerCase()
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos"
  if (m.includes("email not confirmed")) return "Confirma tu email: te enviamos un enlace al registrarte"
  if (m.includes("already registered") || m.includes("already been registered")) return "Ya existe una cuenta con ese email"
  if (m.includes("password") && (m.includes("short") || m.includes("least") || m.includes("weak"))) return "La contraseña es demasiado débil (mínimo 8 caracteres)"
  // Límite de envío de emails de Supabase (SMTP integrado): no es culpa del usuario.
  if (m.includes("email rate limit") || m.includes("over_email_send_rate_limit")) return "Hay mucha demanda, inténtalo en unos minutos."
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera unos minutos."
  if (m.includes("email") && m.includes("invalid")) return "Ese email no es válido"
  return "No se pudo completar. Inténtalo de nuevo."
}
