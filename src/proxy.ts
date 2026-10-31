import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth"
import { isPublicAuthPath, isSupabaseAuthEnabled, USER_ID_COOKIE } from "@/lib/auth-mode"

// Puerta de entrada de la app. Dos modos (ver src/lib/auth-mode.ts):
//  - AUTH_MODE=supabase: cuentas reales con Supabase Auth. Aquí se refresca la
//    sesión en cada petición y, sin sesión, se manda a /login.
//  - modo antiguo (por defecto): una contraseña compartida (APP_PASSWORD) y la
//    cookie app-auth con un token HMAC opaco, como hasta ahora.
// Ambos son fail-closed: si falta configuración la app no se abre (503).
export async function proxy(request: NextRequest) {
  return isSupabaseAuthEnabled() ? supabaseProxy(request) : passwordProxy(request)
}

function unavailable(message: string) {
  return new NextResponse(message, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
}

function redirectToLogin(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No has iniciado sesión" }, { status: 401 })
  }
  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

async function supabaseProxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) return unavailable("Servicio no disponible: falta SUPABASE_URL o SUPABASE_ANON_KEY")

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // getUser() valida el token con Supabase (no se fía solo de la cookie).
  const { data } = await supabase.auth.getUser()
  const user = data.user
  const { pathname } = request.nextUrl

  if (isPublicAuthPath(pathname)) {
    if (user && pathname === "/login") return NextResponse.redirect(new URL("/dashboard", request.url))
    return response
  }
  if (!user) return redirectToLogin(request)

  // Cookie no secreta con el id del usuario: el navegador la usa para vaciar
  // su caché local si en este dispositivo entra otra persona.
  if (request.cookies.get(USER_ID_COOKIE)?.value !== user.id) {
    response.cookies.set(USER_ID_COOKIE, user.id, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
  }
  return response
}

async function passwordProxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD
  if (!password) return unavailable("Servicio no disponible: falta APP_PASSWORD")

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
  // api/version queda fuera: es pública (solo el id del commit) y la consulta
  // la app para saber si hay versión nueva, también en /login.
  // api/shortcuts y api/backup quedan fuera: los llama un Atajo de iOS o el
  // script de copias, no un navegador. Se protegen con su propia clave
  // (ver src/lib/server/shortcut-auth.ts), que además dice de quién son.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|icons/|manifest.webmanifest|api/shortcuts|api/backup|api/version).*)"],
}
