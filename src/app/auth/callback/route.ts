import { NextResponse } from "next/server"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { parseOtpType } from "@/lib/auth-links"
import { createSupabaseRouteClient } from "@/lib/server/request-context"

// Destino de los enlaces de los emails con las plantillas por defecto de
// Supabase (?code=, flujo PKCE). Las plantillas nuevas usan /auth/confirm,
// que funciona en cualquier navegador; esto queda para enlaces antiguos.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const go = (path: string) => NextResponse.redirect(new URL(path, url.origin))
  if (!isSupabaseAuthEnabled()) return go("/login?error=enlace")

  // Supabase ya rechazó el enlace (usado o caducado) y nos manda el motivo.
  if (url.searchParams.get("error") || url.searchParams.get("error_code")) {
    console.warn("[auth/callback]", url.searchParams.get("error_code") ?? url.searchParams.get("error"))
    return go("/login?aviso=enlace-usado")
  }

  const supabase = await createSupabaseRouteClient()
  const code = url.searchParams.get("code")
  const tokenHash = url.searchParams.get("token_hash")
  const type = parseOtpType(url.searchParams.get("type"))
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // Si llega un ?code= es que Supabase YA verificó el email. Falla el
      // canje cuando el enlace se abre en otro navegador (p. ej. el de Gmail)
      // y no está el code_verifier del registro. La cuenta está confirmada:
      // basta con entrar con la contraseña.
      console.warn("[auth/callback]", error.code ?? "", error.message)
      return go("/login?aviso=confirmado")
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) {
      console.warn("[auth/callback]", error.code ?? "", error.message)
      return go("/login?aviso=enlace-usado")
    }
  } else {
    return go("/login?error=enlace")
  }
  return go("/dashboard")
}
