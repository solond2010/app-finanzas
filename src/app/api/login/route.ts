import { NextResponse } from "next/server"
import {
  AUTH_COOKIE_NAME,
  checkLoginRateLimit,
  clearLoginAttempts,
  createSessionToken,
  recordFailedLogin,
  timingSafeEqualString,
} from "@/lib/auth"

// x-forwarded-for puede traer varias IPs separadas por coma (cadena de
// proxies); la primera es la del cliente original.
function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")
  return fwd?.split(",")[0]?.trim() || "unknown"
}

export async function POST(request: Request) {
  const expected = process.env.APP_PASSWORD
  if (!expected) {
    return NextResponse.json(
      { error: "Auth no configurada (falta APP_PASSWORD)" },
      { status: 503 },
    )
  }

  const ip = getClientIp(request)
  const rateLimit = checkLoginRateLimit(ip)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Inténtalo de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 300) } },
    )
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "El cuerpo JSON no es válido" }, { status: 400 })
  }
  const password = body && typeof body === "object" ? (body as { password?: unknown }).password : undefined

  if (typeof password !== "string" || !timingSafeEqualString(password, expected)) {
    recordFailedLogin(ip)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  clearLoginAttempts(ip)

  const sessionToken = await createSessionToken(expected)
  const response = NextResponse.json({ ok: true })
  response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    // "Secure" hace que el navegador descarte la cookie en conexiones sin
    // cifrar (http://, como el servidor de dev local o una preview servida
    // por http). En producción (Vercel, siempre https) sí debe ir activado.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}
