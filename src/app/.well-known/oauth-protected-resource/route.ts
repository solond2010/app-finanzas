import { oauthJson, oauthOptions } from "@/lib/oauth/http"
import { protectedResourceMetadata } from "@/lib/oauth/metadata"

export const dynamic = "force-dynamic"

export function GET() {
  return oauthJson(protectedResourceMetadata())
}

export function OPTIONS() {
  return oauthOptions()
}
