import { oauthJson, oauthOptions, readTokenRequest, withClientCredentials } from "@/lib/oauth/http"
import { getOauthService } from "@/lib/oauth/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = withClientCredentials(request, await readTokenRequest(request))
  const token = body.token || body.refresh_token || body.access_token
  if (!token) return oauthJson({ error: "invalid_request", error_description: "Falta el token" }, 400)
  const result = await getOauthService().revokePresentedToken(token, body.client_id || undefined, body.client_secret || undefined)
  if ("error" in result) return oauthJson({ error: result.error, error_description: result.error_description }, result.status)
  return oauthJson({ ok: true })
}

export function OPTIONS() {
  return oauthOptions()
}
