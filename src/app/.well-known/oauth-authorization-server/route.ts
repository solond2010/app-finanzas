import { oauthJson, oauthOptions } from "@/lib/oauth/http"
import { authorizationServerMetadata } from "@/lib/oauth/metadata"

export const dynamic = "force-dynamic"

export function GET() {
  return oauthJson(authorizationServerMetadata())
}

export function OPTIONS() {
  return oauthOptions()
}
