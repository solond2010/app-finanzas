import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { createSupabaseRouteClient } from "@/lib/server/request-context"

// Destino de los enlaces de los emails (confirmar registro, entrar sin
// contraseña). Cambia el código del enlace por una sesión y entra en la app.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const fail = NextResponse.redirect(new URL("/login?error=enlace", url.origin))
  if (!isSupabaseAuthEnabled()) return fail
  const supabase = await createSupabaseRouteClient()

  const code = url.searchParams.get("code")
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type") as EmailOtpType | null
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return fail
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) return fail
  } else {
    return fail
  }
  return NextResponse.redirect(new URL("/dashboard", url.origin))
}
