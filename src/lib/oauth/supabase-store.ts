import "server-only"

import { supabaseServer } from "@/lib/supabase-server"
import type { TokenEndpointAuthMethod } from "@/lib/oauth/constants"
import type {
  OauthAccessToken,
  OauthAuthorizationCode,
  OauthClient,
  OauthGrant,
  OauthPendingConsent,
  OauthRefreshToken,
  OauthStore,
} from "@/lib/oauth/types"

function asClient(row: {
  client_id: string
  client_secret_hash: string | null
  client_name: string
  redirect_uris: string[]
  token_endpoint_auth_method: string
  revoked_at: string | null
}): OauthClient {
  return {
    clientId: row.client_id,
    clientSecretHash: row.client_secret_hash,
    clientName: row.client_name,
    redirectUris: row.redirect_uris,
    tokenEndpointAuthMethod: row.token_endpoint_auth_method as TokenEndpointAuthMethod,
    revokedAt: row.revoked_at,
  }
}

function asGrant(row: {
  id: string
  user_id: string
  client_id: string
  client_name: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}): OauthGrant {
  return {
    id: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    clientName: row.client_name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  }
}

export const supabaseOauthStore: OauthStore = {
  async insertClient(client) {
    const { error } = await supabaseServer.from("oauth_clients").insert({
      client_id: client.clientId,
      client_secret_hash: client.clientSecretHash,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
    })
    if (error) throw new Error(error.message)
  },
  async getClient(clientId) {
    const { data, error } = await supabaseServer.from("oauth_clients").select("client_id, client_secret_hash, client_name, redirect_uris, token_endpoint_auth_method, revoked_at").eq("client_id", clientId).maybeSingle()
    if (error) throw new Error(error.message)
    return data ? asClient(data as never) : null
  },
  async insertPendingConsent(row) {
    const { error } = await supabaseServer.from("oauth_pending_consents").insert({
      id: row.id,
      user_id: row.userId,
      client_id: row.clientId,
      redirect_uri: row.redirectUri,
      code_challenge: row.codeChallenge,
      state: row.state,
      resource: row.resource,
      scope: row.scope,
      expires_at: row.expiresAt,
    })
    if (error) throw new Error(error.message)
  },
  async getPendingConsent(id) {
    const { data, error } = await supabaseServer.from("oauth_pending_consents").select("id, user_id, client_id, redirect_uri, code_challenge, state, resource, scope, expires_at").eq("id", id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    const row = data as {
      id: string
      user_id: string
      client_id: string
      redirect_uri: string
      code_challenge: string
      state: string | null
      resource: string | null
      scope: string
      expires_at: string
    }
    return {
      id: row.id,
      userId: row.user_id,
      clientId: row.client_id,
      redirectUri: row.redirect_uri,
      codeChallenge: row.code_challenge,
      state: row.state,
      resource: row.resource,
      scope: row.scope,
      expiresAt: row.expires_at,
    } satisfies OauthPendingConsent
  },
  async deletePendingConsent(id) {
    const { error } = await supabaseServer.from("oauth_pending_consents").delete().eq("id", id)
    if (error) throw new Error(error.message)
  },
  async insertGrant(row) {
    const { error } = await supabaseServer.from("oauth_grants").insert({
      id: row.id,
      user_id: row.userId,
      client_id: row.clientId,
      client_name: row.clientName,
      created_at: row.createdAt,
      last_used_at: row.lastUsedAt,
    })
    if (error) throw new Error(error.message)
  },
  async getGrant(id) {
    const { data, error } = await supabaseServer.from("oauth_grants").select("id, user_id, client_id, client_name, created_at, last_used_at, revoked_at").eq("id", id).maybeSingle()
    if (error) throw new Error(error.message)
    return data ? asGrant(data as never) : null
  },
  async listActiveGrants(userId) {
    const { data, error } = await supabaseServer
      .from("oauth_grants")
      .select("id, user_id, client_id, client_name, created_at, last_used_at, revoked_at")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => asGrant(row as never))
  },
  async revokeGrant(userId, grantId, at) {
    const { data, error } = await supabaseServer
      .from("oauth_grants")
      .update({ revoked_at: at })
      .eq("id", grantId)
      .eq("user_id", userId)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle()
    if (error) throw new Error(error.message)
    return Boolean(data)
  },
  async touchGrant(id, at) {
    const { error } = await supabaseServer.from("oauth_grants").update({ last_used_at: at }).eq("id", id)
    if (error) throw new Error(error.message)
  },
  async insertAuthorizationCode(row) {
    const { error } = await supabaseServer.from("oauth_authorization_codes").insert({
      code_hash: row.codeHash,
      client_id: row.clientId,
      user_id: row.userId,
      grant_id: row.grantId,
      redirect_uri: row.redirectUri,
      code_challenge: row.codeChallenge,
      resource: row.resource,
      scope: row.scope,
      expires_at: row.expiresAt,
    })
    if (error) throw new Error(error.message)
  },
  async getAuthorizationCode(codeHash) {
    const { data, error } = await supabaseServer.from("oauth_authorization_codes").select("code_hash, client_id, user_id, grant_id, redirect_uri, code_challenge, resource, scope, expires_at, used_at").eq("code_hash", codeHash).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    const row = data as {
      code_hash: string
      client_id: string
      user_id: string
      grant_id: string
      redirect_uri: string
      code_challenge: string
      resource: string | null
      scope: string
      expires_at: string
      used_at: string | null
    }
    return {
      codeHash: row.code_hash,
      clientId: row.client_id,
      userId: row.user_id,
      grantId: row.grant_id,
      redirectUri: row.redirect_uri,
      codeChallenge: row.code_challenge,
      resource: row.resource,
      scope: row.scope,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
    } satisfies OauthAuthorizationCode
  },
  async markAuthorizationCodeUsed(codeHash, at) {
    const { error } = await supabaseServer.from("oauth_authorization_codes").update({ used_at: at }).eq("code_hash", codeHash)
    if (error) throw new Error(error.message)
  },
  async insertAccessToken(row) {
    const { error } = await supabaseServer.from("oauth_access_tokens").insert({
      id: row.id,
      token_hash: row.tokenHash,
      grant_id: row.grantId,
      client_id: row.clientId,
      user_id: row.userId,
      scope: row.scope,
      expires_at: row.expiresAt,
    })
    if (error) throw new Error(error.message)
  },
  async getAccessToken(tokenHash) {
    const { data, error } = await supabaseServer.from("oauth_access_tokens").select("id, token_hash, grant_id, client_id, user_id, scope, expires_at, revoked_at").eq("token_hash", tokenHash).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    const row = data as OauthAccessToken & { token_hash: string; grant_id: string; client_id: string; user_id: string; expires_at: string; revoked_at: string | null }
    return {
      id: (data as { id: string }).id,
      tokenHash: row.token_hash,
      grantId: row.grant_id,
      clientId: row.client_id,
      userId: row.user_id,
      scope: (data as { scope: string }).scope,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    }
  },
  async revokeAccessTokensForGrant(grantId, at) {
    const { error } = await supabaseServer.from("oauth_access_tokens").update({ revoked_at: at }).eq("grant_id", grantId).is("revoked_at", null)
    if (error) throw new Error(error.message)
  },
  async touchAccessToken(id, at) {
    const { error } = await supabaseServer.from("oauth_access_tokens").update({ last_used_at: at }).eq("id", id)
    if (error) throw new Error(error.message)
  },
  async insertRefreshToken(row) {
    const { error } = await supabaseServer.from("oauth_refresh_tokens").insert({
      id: row.id,
      token_hash: row.tokenHash,
      grant_id: row.grantId,
      client_id: row.clientId,
      user_id: row.userId,
      scope: row.scope,
      expires_at: row.expiresAt,
    })
    if (error) throw new Error(error.message)
  },
  async getRefreshToken(tokenHash) {
    const { data, error } = await supabaseServer.from("oauth_refresh_tokens").select("id, token_hash, grant_id, client_id, user_id, scope, expires_at, revoked_at").eq("token_hash", tokenHash).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    const row = data as OauthRefreshToken & { token_hash: string; grant_id: string; client_id: string; user_id: string; expires_at: string; revoked_at: string | null }
    return {
      id: (data as { id: string }).id,
      tokenHash: row.token_hash,
      grantId: row.grant_id,
      clientId: row.client_id,
      userId: row.user_id,
      scope: (data as { scope: string }).scope,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    }
  },
  async revokeRefreshToken(id, at) {
    const { error } = await supabaseServer.from("oauth_refresh_tokens").update({ revoked_at: at }).eq("id", id)
    if (error) throw new Error(error.message)
  },
  async revokeRefreshTokensForGrant(grantId, at) {
    const { error } = await supabaseServer.from("oauth_refresh_tokens").update({ revoked_at: at }).eq("grant_id", grantId).is("revoked_at", null)
    if (error) throw new Error(error.message)
  },
}
