import { NextResponse } from "next/server"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { defaultNextForOtp, parseOtpType } from "@/lib/auth-links"
import { safeNextPath } from "@/lib/auth-redirect"
import { createSupabaseRouteClient } from "@/lib/server/request-context"

// Verifica el enlace del email (token_hash + type) y abre sesión en ESTE
// navegador. Patrón recomendado de Supabase SSR: no necesita el code_verifier
// del navegador donde se hizo el registro, así que vale aunque el enlace se
// abra en el navegador de Gmail, en otro móvil o en el ordenador.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin
  const go = (path: string) => NextResponse.redirect(new URL(path, origin), 303)
  if (!isSupabaseAuthEnabled()) return go("/login?error=enlace")

  const form = await request.formData().catch(() => null)
  const tokenHash = form?.get("token_hash")
  const type = parseOtpType(typeof form?.get("type") === "string" ? (form?.get("type") as string) : null)
  if (typeof tokenHash !== "string" || !tokenHash || !type) return go("/login?error=enlace")
  const nextRaw = form?.get("next")
  const next = safeNextPath(typeof nextRaw === "string" ? nextRaw : null, defaultNextForOtp(type))

  const supabase = await createSupabaseRouteClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  if (error) {
    // Lo normal: el enlace ya se usó (p. ej. pulsado dos veces) o caducó.
    console.warn("[auth/confirm]", error.code ?? "", error.message)
    return go("/login?aviso=enlace-usado")
  }
  return go(next)
}

// Si alguien abre esta URL directamente, que vea la página con el botón.
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/login?error=enlace", new URL(request.url).origin))
}
