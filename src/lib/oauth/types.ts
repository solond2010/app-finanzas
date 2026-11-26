import type { TokenEndpointAuthMethod } from "@/lib/oauth/constants"

export type OauthClient = {
  clientId: string
  clientSecretHash: string | null
  clientName: string
  redirectUris: string[]
  tokenEndpointAuthMethod: TokenEndpointAuthMethod
  revokedAt: string | null
}

export type OauthGrant = {
  id: string
  userId: string
  clientId: string
  clientName: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export type OauthPendingConsent = {
  id: string
  userId: string
  clientId: string
  redirectUri: string
  codeChallenge: string
  state: string | null
  resource: string | null
  scope: string
  expiresAt: string
}

export type OauthAuthorizationCode = {
  codeHash: string
  clientId: string
  userId: string
  grantId: string
  redirectUri: string
  codeChallenge: string
  resource: string | null
  scope: string
  expiresAt: string
  usedAt: string | null
}

export type OauthAccessToken = {
  id: string
  tokenHash: string
  grantId: string
  clientId: string
  userId: string
  scope: string
  expiresAt: string
  revokedAt: string | null
}

export type OauthRefreshToken = {
  id: string
  tokenHash: string
  grantId: string
  clientId: string
  userId: string
  scope: string
  expiresAt: string
  revokedAt: string | null
}

export type OauthStore = {
  insertClient(client: OauthClient): Promise<void>
  getClient(clientId: string): Promise<OauthClient | null>
  insertPendingConsent(row: OauthPendingConsent): Promise<void>
  getPendingConsent(id: string): Promise<OauthPendingConsent | null>
  deletePendingConsent(id: string): Promise<void>
  insertGrant(row: OauthGrant): Promise<void>
  getGrant(id: string): Promise<OauthGrant | null>
  listActiveGrants(userId: string): Promise<OauthGrant[]>
  revokeGrant(userId: string, grantId: string, at: string): Promise<boolean>
  touchGrant(id: string, at: string): Promise<void>
  insertAuthorizationCode(row: OauthAuthorizationCode): Promise<void>
  getAuthorizationCode(codeHash: string): Promise<OauthAuthorizationCode | null>
  markAuthorizationCodeUsed(codeHash: string, at: string): Promise<void>
  insertAccessToken(row: OauthAccessToken): Promise<void>
  getAccessToken(tokenHash: string): Promise<OauthAccessToken | null>
  revokeAccessTokensForGrant(grantId: string, at: string): Promise<void>
  touchAccessToken(id: string, at: string): Promise<void>
  insertRefreshToken(row: OauthRefreshToken): Promise<void>
  getRefreshToken(tokenHash: string): Promise<OauthRefreshToken | null>
  revokeRefreshToken(id: string, at: string): Promise<void>
  revokeRefreshTokensForGrant(grantId: string, at: string): Promise<void>
}
