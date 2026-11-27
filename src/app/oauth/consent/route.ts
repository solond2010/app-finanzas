import { NextResponse } from "next/server"
import { oauthClientRedirect } from "@/lib/oauth/http"
import { getDataContext } from "@/lib/server/request-context"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { getOauthService } from "@/lib/oauth/server"
import { CONNECTORS_PRO_HREF } from "@/lib/billing/connectors-access"
import { userCanUseConnectors } from "@/lib/server/connectors-access"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!isSupabaseAuthEnabled()) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  const ctx = await getDataContext()
  if (!ctx) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  const form = await request.formData()
  const pendingId = String(form.get("consent") ?? "")
  const allow = String(form.get("decision") ?? "") === "allow"
  if (allow && !(await userCanUseConnectors(ctx.userId))) {
    return NextResponse.redirect(new URL(CONNECTORS_PRO_HREF, request.url))
  }
  if (!/^[0-9a-f-]{36}$/i.test(pendingId)) {
    return new NextResponse("La solicitud de consentimiento no es válida.", { status: 400 })
  }
  const result = await getOauthService().decideConsent(ctx.userId, pendingId, allow)
  if ("error" in result) {
    return new NextResponse(result.error_description, { status: result.status })
  }
  return oauthClientRedirect(result.redirectTo)
}
