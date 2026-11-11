import { NextResponse } from "next/server"
import { appAuthOrigin, googleCallbackUrl, safeNextPath } from "@/lib/auth-redirect"
import { isGoogleAuthAvailable } from "@/lib/server/google-auth"
import { createSupabaseRouteClient } from "@/lib/server/request-context"
import { guardAuthRequest, json } from "@/lib/server/auth-helpers"

export const dynamic = "force-dynamic"

const GOOGLE_SCOPES = "openid email profile"

async function startGoogleOAuth(request: Request, next: string | null) {
  const blocked = guardAuthRequest(request)
  if (blocked) return blocked
  if (!(await isGoogleAuthAvailable())) {
    return json({ error: "Entrar con Google aún no está disponible" }, 404)
  }

  const supabase = await createSupabaseRouteClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: googleCallbackUrl(next),
      scopes: GOOGLE_SCOPES,
    },
  })
  if (error || !data.url) {
    console.warn("[auth/google]", error?.code ?? "", error?.message ?? "sin url")
    const login = new URL("/login", appAuthOrigin())
    login.searchParams.set("aviso", "google-error")
    const dest = safeNextPath(next)
    if (dest !== "/dashboard") login.searchParams.set("redirect", dest)
    return NextResponse.redirect(login, { status: 303 })
  }
  return NextResponse.redirect(data.url, { status: 303 })
}

export async function GET() {
  // Evita que un prefetch arranque el flujo OAuth.
  return json({ error: "Usa el botón Continuar con Google" }, 405)
}

export async function POST(request: Request) {
  let next: string | null = null
  const contentType = request.headers.get("content-type") ?? ""
  try {
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null)
      if (body && typeof body === "object" && typeof (body as { next?: unknown }).next === "string") {
        next = (body as { next: string }).next
      }
    } else {
      const form = await request.formData()
      const value = form.get("next")
      if (typeof value === "string") next = value
    }
  } catch {
    next = null
  }
  return startGoogleOAuth(request, next)
}
