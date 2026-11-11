import { NextResponse } from "next/server"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { defaultNextForOtp, parseOtpType } from "@/lib/auth-links"
import { appAuthOrigin, safeNextPath } from "@/lib/auth-redirect"
import { createSupabaseRouteClient } from "@/lib/server/request-context"

// Destino de los enlaces de los emails con las plantillas por defecto de
// Supabase (?code=, flujo PKCE) y del retorno de OAuth (flow=google).
// Las plantillas nuevas usan /auth/confirm, que funciona en cualquier
// navegador; /auth/callback queda para enlaces antiguos y para Google.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const go = (path: string) => NextResponse.redirect(new URL(path, appAuthOrigin()))
  if (!isSupabaseAuthEnabled()) return go("/login?error=enlace")

  const isGoogleFlow = url.searchParams.get("flow") === "google"
  const type = parseOtpType(url.searchParams.get("type"))
  const next = safeNextPath(url.searchParams.get("next"), type ? defaultNextForOtp(type) : "/dashboard")
  const loginRedirect = (aviso: string) => {
    const login = new URL("/login", appAuthOrigin())
    login.searchParams.set("aviso", aviso)
    if (next !== "/dashboard") login.searchParams.set("redirect", next)
    return NextResponse.redirect(login)
  }

  // Supabase o el proveedor rechazaron el flujo (cancelación, error, enlace usado).
  if (url.searchParams.get("error") || url.searchParams.get("error_code")) {
    const reason = (url.searchParams.get("error_code") ?? url.searchParams.get("error") ?? "").toLowerCase()
    console.warn("[auth/callback]", reason)
    if (isGoogleFlow || reason.includes("access_denied") || reason.includes("canceled") || reason.includes("cancelled")) {
      return loginRedirect(reason.includes("access_denied") || reason.includes("cancel") ? "google-cancelado" : "google-error")
    }
    return go("/login?aviso=enlace-usado")
  }

  const supabase = await createSupabaseRouteClient()
  const code = url.searchParams.get("code")
  const tokenHash = url.searchParams.get("token_hash")
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // Si llega un ?code= de un email, Supabase YA verificó el correo. Falla el
      // canje cuando el enlace se abre en otro navegador y no está el
      // code_verifier: la cuenta está confirmada y basta entrar con contraseña.
      // En el flujo de Google no apliques ese aviso: el usuario no confirmó un email.
      console.warn("[auth/callback]", error.code ?? "", error.message)
      if (isGoogleFlow) return loginRedirect("google-error")
      // Recuperación: no les pedimos la contraseña que no recuerdan.
      if (type === "recovery") return go("/login?aviso=enlace-usado")
      return go("/login?aviso=confirmado")
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) {
      console.warn("[auth/callback]", error.code ?? "", error.message)
      return go("/login?aviso=enlace-usado")
    }
  } else {
    return isGoogleFlow ? loginRedirect("google-error") : go("/login?error=enlace")
  }
  return go(next)
}
