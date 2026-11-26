import { CANONICAL_SITE_ORIGIN } from "@/lib/auth-redirect"
import { MCP_ENDPOINT_URL } from "@/lib/mcp/public"
import { OAUTH_SCOPE, TOKEN_ENDPOINT_AUTH_METHODS } from "@/lib/oauth/constants"

export function oauthIssuer(): string {
  const configured = process.env.SITE_URL?.replace(/\/+$/, "")
  if (configured) return configured
  if (process.env.NODE_ENV === "development") return "http://localhost:3000"
  return CANONICAL_SITE_ORIGIN
}

export function authorizationServerMetadata(issuer = oauthIssuer()) {
  const base = issuer.replace(/\/+$/, "")
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    scopes_supported: [OAUTH_SCOPE],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: [...TOKEN_ENDPOINT_AUTH_METHODS],
    revocation_endpoint_auth_methods_supported: [...TOKEN_ENDPOINT_AUTH_METHODS],
  }
}

export function protectedResourceMetadata(issuer = oauthIssuer()) {
  const base = issuer.replace(/\/+$/, "")
  return {
    resource: MCP_ENDPOINT_URL,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    scopes_supported: [OAUTH_SCOPE],
  }
}

export function resourceMetadataUrl(issuer = oauthIssuer()) {
  return `${issuer.replace(/\/+$/, "")}/.well-known/oauth-protected-resource`
}

export function wwwAuthenticateChallenge(issuer = oauthIssuer()) {
  return `Bearer realm="Garra MCP", resource_metadata="${resourceMetadataUrl(issuer)}"`
}
