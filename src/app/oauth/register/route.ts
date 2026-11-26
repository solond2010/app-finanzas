import { oauthJson, oauthOptions } from "@/lib/oauth/http"
import { getOauthService } from "@/lib/oauth/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return oauthJson({ error: "invalid_client_metadata", error_description: "El cuerpo debe ser un objeto JSON" }, 400)
  }
  const result = await getOauthService().registerClient(body as Record<string, unknown>)
  if ("error" in result) return oauthJson({ error: result.error, error_description: result.error_description }, result.status)
  return oauthJson(result, 201)
}

export function OPTIONS() {
  return oauthOptions()
}
