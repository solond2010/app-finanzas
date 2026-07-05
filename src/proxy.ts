import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { timingSafeEqualString } from "@/lib/auth"

// Auth de un solo secreto compartido (sin usuarios ni sesiones individuales),
// a juego con el resto de la app: store.tsx escribe siempre con un `USER_ID`
// fijo. Válido mientras esta sea una app personal de un único usuario; si en
// algún momento hay más de una persona accediendo, esto necesita migrar a
// autenticación real (p. ej. Supabase Auth) antes de considerarse seguro.
export function proxy(request: NextRequest) {
  const authCookie = request.cookies.get("app-auth")?.value
  const password = process.env.APP_PASSWORD

  if (!password) return NextResponse.next()
  const authed = authCookie != null && timingSafeEqualString(authCookie, password)

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/shortcuts).*)"],
}
