import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth"

// Auth de un solo secreto compartido (sin usuarios ni sesiones individuales),
// a juego con el resto de la app: store.tsx escribe siempre con un `USER_ID`
// fijo. Válido mientras esta sea una app personal de un único usuario; si en
// algún momento hay más de una persona accediendo, esto necesita migrar a
// autenticación real (p. ej. Supabase Auth) antes de considerarse seguro.
//
// Fail-closed: sin APP_PASSWORD la app no se abre (503), nunca next() abierto.
// La cookie `app-auth` guarda un token HMAC opaco, no la contraseña en claro.
export async function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD

  if (!password) {
    return new NextResponse("Servicio no disponible: falta APP_PASSWORD", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  const authCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const authed = await isValidSessionToken(authCookie, password)

  if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/api/login") {
    if (authed && request.nextUrl.pathname !== "/api/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    return NextResponse.next()
  }

  if (!authed) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // api/shortcuts queda fuera del gate de contraseña: lo llama un Atajo de
  // iOS, no un navegador, así que no puede mandar la cookie app-auth. Esa
  // ruta se protege con su propio secreto (ver SHORTCUTS_SECRET).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/shortcuts|api/backup).*)"],
}
