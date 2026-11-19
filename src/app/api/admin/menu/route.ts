import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server/require-admin"
import { json } from "@/lib/server/auth-helpers"
import { HIDE_ADMIN_NAV_COOKIE, HIDE_ADMIN_NAV_COOKIE_OPTIONS } from "@/lib/server/admin-nav-cookie"

// Preferencia por dispositivo: oculta el enlace de Administración en este
// navegador. Solo el admin puede cambiarla.

const notFound = () => json({ error: "No encontrado" }, 404)

export async function POST(request: Request) {
  const ctx = await requireAdmin()
  if (!ctx) return notFound()
  const form = await request.formData().catch(() => null)
  const hide = form?.get("hidden") === "1"
  const url = new URL("/configuracion", request.url)
  const response = NextResponse.redirect(url, 303)
  if (hide) response.cookies.set(HIDE_ADMIN_NAV_COOKIE, "1", HIDE_ADMIN_NAV_COOKIE_OPTIONS)
  else response.cookies.delete({ name: HIDE_ADMIN_NAV_COOKIE, path: "/" })
  response.headers.set("Cache-Control", "no-store")
  return response
}
