import { oauthJson, oauthOptions, readTokenRequest, withClientCredentials } from "@/lib/oauth/http"
import { getOauthService } from "@/lib/oauth/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = withClientCredentials(request, await readTokenRequest(request))
  const result = await getOauthService().issueToken(body)
  if ("error" in result) return oauthJson({ error: result.error, error_description: result.error_description }, result.status)
  return oauthJson(result)
}

export function OPTIONS() {
  return oauthOptions()
}
