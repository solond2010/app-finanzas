import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME } from "@/lib/auth"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { createSupabaseRouteClient, getDataContext, unauthorizedResponse } from "@/lib/server/request-context"
import { DELETE_CONFIRMATION, deleteUserEverywhere } from "@/lib/server/account-deletion"
import { supabaseServer } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

/** Borra la cuenta de quien ha iniciado sesión: todos sus datos y su usuario. */
export async function POST(request: Request) {
  if (!isSupabaseAuthEnabled() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "El borrado de cuenta no está disponible ahora mismo" }, { status: 503 })
  }
  const ctx = await getDataContext()
  if (!ctx) return unauthorizedResponse()
  let body: { confirm?: unknown } = {}
  try { body = await request.json() } catch {}
  if (body.confirm !== DELETE_CONFIRMATION) return NextResponse.json({ error: `Escribe ${DELETE_CONFIRMATION} para confirmar` }, { status: 400 })

  const { data: admin } = await supabaseServer.from("app_admins").select("user_id").eq("user_id", ctx.userId).maybeSingle()
  if (admin) return NextResponse.json({ error: "Las cuentas de administrador no se pueden borrar desde aquí" }, { status: 403 })

  try {
    await deleteUserEverywhere(supabaseServer, ctx.userId)
  } catch (error) {
    console.error("[account-delete]", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "No se pudo borrar la cuenta. No se ha cerrado tu sesión; inténtalo de nuevo." }, { status: 500 })
  }
  try { await (await createSupabaseRouteClient()).auth.signOut() } catch {}
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
  response.cookies.set(AUTH_COOKIE_NAME, "", { path: "/", maxAge: 0 })
  return response
}
