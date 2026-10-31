import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME } from "@/lib/auth"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { createSupabaseRouteClient } from "@/lib/server/request-context"

export async function POST() {
  if (isSupabaseAuthEnabled()) {
    const supabase = await createSupabaseRouteClient()
    await supabase.auth.signOut()
  }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
  response.cookies.set(AUTH_COOKIE_NAME, "", { path: "/", maxAge: 0 })
  return response
}
