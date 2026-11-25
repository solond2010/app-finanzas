import { describe, expect, it } from "vitest"
import { CANONICAL_SITE_ORIGIN } from "@/lib/auth-redirect"
import { MCP_ENDPOINT_URL } from "@/lib/mcp/public"
import { authorizationServerMetadata, protectedResourceMetadata, wwwAuthenticateChallenge } from "@/lib/oauth/metadata"

describe("metadatos OAuth", () => {
  it("publica los endpoints y solo S256", () => {
    const meta = authorizationServerMetadata(CANONICAL_SITE_ORIGIN)
    expect(meta.issuer).toBe(CANONICAL_SITE_ORIGIN)
    expect(meta.authorization_endpoint).toBe(`${CANONICAL_SITE_ORIGIN}/oauth/authorize`)
    expect(meta.token_endpoint).toBe(`${CANONICAL_SITE_ORIGIN}/oauth/token`)
    expect(meta.registration_endpoint).toBe(`${CANONICAL_SITE_ORIGIN}/oauth/register`)
    expect(meta.code_challenge_methods_supported).toEqual(["S256"])
    expect(meta.grant_types_supported).toContain("authorization_code")
  })

  it("apunta el recurso protegido al MCP y el reto 401 a resource_metadata", () => {
    const resource = protectedResourceMetadata(CANONICAL_SITE_ORIGIN)
    expect(resource.resource).toBe(MCP_ENDPOINT_URL)
    expect(resource.authorization_servers).toEqual([CANONICAL_SITE_ORIGIN])
    expect(wwwAuthenticateChallenge(CANONICAL_SITE_ORIGIN)).toContain(`${CANONICAL_SITE_ORIGIN}/.well-known/oauth-protected-resource`)
  })
})
