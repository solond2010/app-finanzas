import { NextResponse } from "next/server"
import { DEMO_COOKIE, DEMO_COOKIE_VALUE } from "@/lib/demo/constants"

// «Ver demo»: marca este navegador en modo demo (cookie de sesión, se borra
// al cerrar el navegador) y abre Inicio con datos ficticios. No se crea
// ninguna cuenta ni se toca Supabase.
export const dynamic = "force-dynamic"

export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303)
  response.cookies.set(DEMO_COOKIE, DEMO_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
  response.headers.set("Cache-Control", "no-store")
  return response
}
