import { randomUUID } from "crypto"
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  OAUTH_SCOPE,
  PENDING_CONSENT_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  TOKEN_ENDPOINT_AUTH_METHODS,
  type TokenEndpointAuthMethod,
} from "@/lib/oauth/constants"
import { isAllowedRedirectUri, parseRedirectUris, sameRedirectUri } from "@/lib/oauth/redirect"
import { isValidCodeChallenge, verifyPkceS256 } from "@/lib/oauth/pkce"
import {
  hashOauthSecret,
  hashesEqual,
  isAuthorizationCodeFormat,
  isOAuthAccessTokenFormat,
  isOAuthRefreshTokenFormat,
  newAccessToken,
  newAuthorizationCode,
  newClientId,
  newClientSecret,
  newRefreshToken,
} from "@/lib/oauth/tokens"
import type { OauthClient, OauthGrant, OauthStore } from "@/lib/oauth/types"

export type OauthError = {
  error: string
  error_description: string
  status: number
}

export type RegisterInput = {
  client_name?: unknown
  redirect_uris?: unknown
  token_endpoint_auth_method?: unknown
}

export type AuthorizeQuery = {
  client_id?: unknown
  redirect_uri?: unknown
  response_type?: unknown
  code_challenge?: unknown
  code_challenge_method?: unknown
  state?: unknown
  scope?: unknown
  resource?: unknown
}

export type TokenInput = {
  grant_type?: unknown
  code?: unknown
  redirect_uri?: unknown
  code_verifier?: unknown
  refresh_token?: unknown
  client_id?: unknown
  client_secret?: unknown
}

function fail(error: string, error_description: string, status = 400): OauthError {
  return { error, error_description, status }
}

function isError(value: unknown): value is OauthError {
  return Boolean(value && typeof value === "object" && "error" in value && "status" in value)
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function plusSeconds(now: Date, seconds: number): string {
  return new Date(now.getTime() + seconds * 1000).toISOString()
}

function isExpired(expiresAt: string, now: Date): boolean {
  return new Date(expiresAt).getTime() <= now.getTime()
}

function parseAuthMethod(value: unknown): TokenEndpointAuthMethod | null {
  if (value === undefined || value === null || value === "") return "none"
  if (typeof value === "string" && (TOKEN_ENDPOINT_AUTH_METHODS as readonly string[]).includes(value)) {
    return value as TokenEndpointAuthMethod
  }
  return null
}

export function createOauthService(store: OauthStore, now: () => Date = () => new Date()) {
  async function authenticateClient(input: { clientId: string; clientSecret?: string }): Promise<OauthClient | OauthError> {
    const client = await store.getClient(input.clientId)
    if (!client || client.revokedAt) return fail("invalid_client", "El cliente no es válido", 401)
    if (client.clientSecretHash) {
      if (!input.clientSecret || !hashesEqual(hashOauthSecret(input.clientSecret), client.clientSecretHash)) {
        return fail("invalid_client", "Las credenciales del cliente no son válidas", 401)
      }
    }
    return client
  }

  return {
    async registerClient(input: RegisterInput) {
      const redirectUris = parseRedirectUris(input.redirect_uris)
      if (!redirectUris) {
        return fail("invalid_client_metadata", "redirect_uris debe ser una lista de URLs https o de localhost")
      }
      const authMethod = parseAuthMethod(input.token_endpoint_auth_method)
      if (!authMethod) return fail("invalid_client_metadata", "token_endpoint_auth_method no es válido")
      const name = typeof input.client_name === "string" ? input.client_name.trim().slice(0, 80) : ""
      const at = now()
      const clientId = newClientId()
      const secret = authMethod === "none" ? null : newClientSecret()
      await store.insertClient({
        clientId,
        clientSecretHash: secret ? hashOauthSecret(secret) : null,
        clientName: name || "Cliente MCP",
        redirectUris,
        tokenEndpointAuthMethod: authMethod,
        revokedAt: null,
      })
      return {
        client_id: clientId,
        client_id_issued_at: Math.floor(at.getTime() / 1000),
        client_name: name || "Cliente MCP",
        redirect_uris: redirectUris,
        token_endpoint_auth_method: authMethod,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        code_challenge_methods: ["S256"],
        ...(secret ? { client_secret: secret } : {}),
      }
    },

    async startAuthorization(userId: string, query: AuthorizeQuery) {
      const clientId = asString(query.client_id)
      const redirectUri = asString(query.redirect_uri)
      const client = clientId ? await store.getClient(clientId) : null
      const canRedirect = Boolean(client && !client.revokedAt && client.redirectUris.includes(redirectUri) && isAllowedRedirectUri(redirectUri))

      const abort = (error: string, description: string) => {
        if (!canRedirect) return fail(error, description, 400)
        return { redirectTo: buildRedirect(redirectUri, { error, error_description: description, state: asString(query.state) || undefined }) }
      }

      if (!client || client.revokedAt) return fail("invalid_request", "El cliente no es válido")
      if (!isAllowedRedirectUri(redirectUri) || !client.redirectUris.includes(redirectUri)) {
        return fail("invalid_request", "redirect_uri no está registrada o no está permitida")
      }
      if (asString(query.response_type) !== "code") return abort("unsupported_response_type", "Solo se admite response_type=code")
      if (asString(query.code_challenge_method) !== "S256") return abort("invalid_request", "code_challenge_method debe ser S256")
      const challenge = asString(query.code_challenge)
      if (!isValidCodeChallenge(challenge)) return abort("invalid_request", "code_challenge no es válido")
      const scope = asString(query.scope) || OAUTH_SCOPE
      if (scope !== OAUTH_SCOPE) return abort("invalid_scope", "El alcance solicitado no está disponible")

      const at = now()
      const pending = {
        id: randomUUID(),
        userId,
        clientId: client.clientId,
        redirectUri,
        codeChallenge: challenge,
        state: asString(query.state) || null,
        resource: asString(query.resource) || null,
        scope: OAUTH_SCOPE,
        expiresAt: plusSeconds(at, PENDING_CONSENT_TTL_SECONDS),
      }
      await store.insertPendingConsent(pending)
      return { pending, client }
    },

    async decideConsent(userId: string, pendingId: string, allow: boolean) {
      const pending = await store.getPendingConsent(pendingId)
      if (!pending || pending.userId !== userId) return fail("invalid_request", "El consentimiento no es válido o ha caducado")
      if (isExpired(pending.expiresAt, now())) {
        await store.deletePendingConsent(pendingId)
        return fail("invalid_request", "El consentimiento ha caducado")
      }
      await store.deletePendingConsent(pendingId)
      const state = pending.state || undefined
      if (!allow) {
        return { redirectTo: buildRedirect(pending.redirectUri, { error: "access_denied", error_description: "El usuario ha denegado el acceso", state }) }
      }
      const at = now()
      const grant: OauthGrant = {
        id: randomUUID(),
        userId,
        clientId: pending.clientId,
        clientName: (await store.getClient(pending.clientId))?.clientName ?? "Cliente MCP",
        createdAt: at.toISOString(),
        lastUsedAt: null,
        revokedAt: null,
      }
      await store.insertGrant(grant)
      const code = newAuthorizationCode()
      await store.insertAuthorizationCode({
        codeHash: hashOauthSecret(code),
        clientId: pending.clientId,
        userId,
        grantId: grant.id,
        redirectUri: pending.redirectUri,
        codeChallenge: pending.codeChallenge,
        resource: pending.resource,
        scope: pending.scope,
        expiresAt: plusSeconds(at, AUTH_CODE_TTL_SECONDS),
        usedAt: null,
      })
      return { redirectTo: buildRedirect(pending.redirectUri, { code, state }) }
    },

    async issueToken(input: TokenInput) {
      const grantType = asString(input.grant_type)
      const client = await authenticateClient({
        clientId: asString(input.client_id),
        clientSecret: asString(input.client_secret) || undefined,
      })
      if (isError(client)) return client

      if (grantType === "authorization_code") return this.exchangeCode(client, input)
      if (grantType === "refresh_token") return this.refreshToken(client, input)
      return fail("unsupported_grant_type", "grant_type debe ser authorization_code o refresh_token")
    },

    async exchangeCode(client: OauthClient, input: TokenInput) {
      const code = asString(input.code)
      const redirectUri = asString(input.redirect_uri)
      const verifier = asString(input.code_verifier)
      if (!isAuthorizationCodeFormat(code)) return fail("invalid_grant", "El código de autorización no es válido")
      const row = await store.getAuthorizationCode(hashOauthSecret(code))
      if (!row) return fail("invalid_grant", "El código de autorización no es válido")
      if (row.clientId !== client.clientId) return fail("invalid_grant", "El código no corresponde a este cliente")
      if (!sameRedirectUri(row.redirectUri, redirectUri)) return fail("invalid_grant", "redirect_uri no coincide")
      if (row.usedAt) return fail("invalid_grant", "El código de autorización ya se ha usado")
      if (isExpired(row.expiresAt, now())) return fail("invalid_grant", "El código de autorización ha caducado")
      if (!verifyPkceS256(verifier, row.codeChallenge)) return fail("invalid_grant", "code_verifier no es válido")
      const at = now()
      await store.markAuthorizationCodeUsed(row.codeHash, at.toISOString())
      return issuePair(store, {
        grantId: row.grantId,
        clientId: row.clientId,
        userId: row.userId,
        scope: row.scope,
        at,
      })
    },

    async refreshToken(client: OauthClient, input: TokenInput) {
      const refresh = asString(input.refresh_token)
      if (!isOAuthRefreshTokenFormat(refresh)) return fail("invalid_grant", "El refresh token no es válido")
      const row = await store.getRefreshToken(hashOauthSecret(refresh))
      if (!row || row.revokedAt) return fail("invalid_grant", "El refresh token no es válido")
      if (row.clientId !== client.clientId) return fail("invalid_grant", "El refresh token no corresponde a este cliente")
      if (isExpired(row.expiresAt, now())) return fail("invalid_grant", "El refresh token ha caducado")
      const grant = await store.getGrant(row.grantId)
      if (!grant || grant.revokedAt) return fail("invalid_grant", "La conexión ha sido revocada")
      const at = now()
      await store.revokeRefreshToken(row.id, at.toISOString())
      await store.revokeAccessTokensForGrant(row.grantId, at.toISOString())
      return issuePair(store, {
        grantId: row.grantId,
        clientId: row.clientId,
        userId: row.userId,
        scope: row.scope,
        at,
      })
    },

    async resolveAccessToken(token: string, options?: { touchLastUsed?: boolean }) {
      if (!isOAuthAccessTokenFormat(token)) return null
      const row = await store.getAccessToken(hashOauthSecret(token))
      if (!row || row.revokedAt) return null
      if (isExpired(row.expiresAt, now())) return null
      const grant = await store.getGrant(row.grantId)
      if (!grant || grant.revokedAt) return null
      if (options?.touchLastUsed !== false) {
        const at = now().toISOString()
        void store.touchAccessToken(row.id, at)
        void store.touchGrant(row.grantId, at)
      }
      return { userId: row.userId, tokenId: row.id, grantId: row.grantId, clientId: row.clientId, scopes: [row.scope] }
    },

    async listGrants(userId: string) {
      return store.listActiveGrants(userId)
    },

    async revokeGrant(userId: string, grantId: string) {
      const at = now().toISOString()
      const revoked = await store.revokeGrant(userId, grantId, at)
      if (!revoked) return false
      await store.revokeAccessTokensForGrant(grantId, at)
      await store.revokeRefreshTokensForGrant(grantId, at)
      return true
    },

    async revokePresentedToken(token: string, clientId?: string, clientSecret?: string) {
      const at = now().toISOString()
      if (clientId) {
        const client = await authenticateClient({ clientId, clientSecret })
        if (isError(client)) return client
      }
      if (isOAuthRefreshTokenFormat(token)) {
        const row = await store.getRefreshToken(hashOauthSecret(token))
        if (row && (!clientId || row.clientId === clientId)) {
          await store.revokeRefreshToken(row.id, at)
          await store.revokeAccessTokensForGrant(row.grantId, at)
        }
        return { ok: true }
      }
      if (isOAuthAccessTokenFormat(token)) {
        const row = await store.getAccessToken(hashOauthSecret(token))
        if (row && (!clientId || row.clientId === clientId)) {
          await store.revokeAccessTokensForGrant(row.grantId, at)
          await store.revokeRefreshTokensForGrant(row.grantId, at)
        }
        return { ok: true }
      }
      return { ok: true }
    },
  }
}

async function issuePair(store: OauthStore, input: { grantId: string; clientId: string; userId: string; scope: string; at: Date }) {
  const access = newAccessToken()
  const refresh = newRefreshToken()
  await store.insertAccessToken({
    id: randomUUID(),
    tokenHash: hashOauthSecret(access),
    grantId: input.grantId,
    clientId: input.clientId,
    userId: input.userId,
    scope: input.scope,
    expiresAt: plusSeconds(input.at, ACCESS_TOKEN_TTL_SECONDS),
    revokedAt: null,
  })
  await store.insertRefreshToken({
    id: randomUUID(),
    tokenHash: hashOauthSecret(refresh),
    grantId: input.grantId,
    clientId: input.clientId,
    userId: input.userId,
    scope: input.scope,
    expiresAt: plusSeconds(input.at, REFRESH_TOKEN_TTL_SECONDS),
    revokedAt: null,
  })
  return {
    access_token: access,
    token_type: "Bearer" as const,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refresh,
    scope: input.scope,
  }
}

export function buildRedirect(base: string, params: Record<string, string | undefined>) {
  const url = new URL(base)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value)
  }
  return url.toString()
}
