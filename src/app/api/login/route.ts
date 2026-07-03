import { NextResponse } from "next/server"
import { checkLoginRateLimit, clearLoginAttempts, recordFailedLogin, timingSafeEqualString } from "@/lib/auth"

// x-forwarded-for puede traer varias IPs separadas por coma (cadena de
// proxies); la primera es la del cliente original.
function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")
  return fwd?.split(",")[0]?.trim() || "unknown"
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = checkLoginRateLimit(ip)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Inténtalo de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 300) } }
    )
  }

  const { password } = await request.json()
  const expected = process.env.APP_PASSWORD

  if (!expected || typeof password !== "string" || !timingSafeEqualString(password, expected)) {
    recordFailedLogin(ip)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  clearLoginAttempts(ip)

  const response = NextResponse.json({ ok: true })
  response.cookies.set("app-auth", password, {
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
