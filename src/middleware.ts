import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Auth de un solo secreto compartido (sin usuarios ni sesiones individuales),
// a juego con el resto de la app: store.tsx escribe siempre con un `USER_ID`
// fijo. Válido mientras esta sea una app personal de un único usuario; si en
// algún momento hay más de una persona accediendo, esto necesita migrar a
// autenticación real (p. ej. Supabase Auth) antes de considerarse seguro.
export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get("app-auth")?.value
  const password = process.env.APP_PASSWORD

  if (!password) return NextResponse.next()

  if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/api/login") {
    if (authCookie === password && request.nextUrl.pathname !== "/api/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    return NextResponse.next()
  }

  if (authCookie !== password) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
