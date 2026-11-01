import { NextResponse } from "next/server"
import { DEMO_COOKIE } from "@/lib/demo/constants"

// Salir de la demo: borra la cookie y lleva a crear cuenta (?a=registro) o a
// entrar. Navegación completa: el navegador vuelve a arrancar sin el modo demo.
export const dynamic = "force-dynamic"

export function GET(request: Request) {
  const url = new URL(request.url)
  const target = new URL("/login", request.url)
  if (url.searchParams.get("a") === "registro") target.searchParams.set("modo", "registro")
  const response = NextResponse.redirect(target, 303)
  response.cookies.delete(DEMO_COOKIE)
  response.headers.set("Cache-Control", "no-store")
  return response
}
