import type {
  OauthAccessToken,
  OauthAuthorizationCode,
  OauthClient,
  OauthGrant,
  OauthPendingConsent,
  OauthRefreshToken,
  OauthStore,
} from "@/lib/oauth/types"

export function createMemoryOauthStore(): OauthStore {
  const clients = new Map<string, OauthClient>()
  const pending = new Map<string, OauthPendingConsent>()
  const grants = new Map<string, OauthGrant>()
  const codes = new Map<string, OauthAuthorizationCode>()
  const access = new Map<string, OauthAccessToken>()
  const refresh = new Map<string, OauthRefreshToken>()

  return {
    async insertClient(client) { clients.set(client.clientId, client) },
    async getClient(clientId) { return clients.get(clientId) ?? null },
    async insertPendingConsent(row) { pending.set(row.id, row) },
    async getPendingConsent(id) { return pending.get(id) ?? null },
    async deletePendingConsent(id) { pending.delete(id) },
    async insertGrant(row) { grants.set(row.id, row) },
    async getGrant(id) { return grants.get(id) ?? null },
    async listActiveGrants(userId) {
      return [...grants.values()]
        .filter((row) => row.userId === userId && !row.revokedAt)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    async revokeGrant(userId, grantId, at) {
      const row = grants.get(grantId)
      if (!row || row.userId !== userId || row.revokedAt) return false
      grants.set(grantId, { ...row, revokedAt: at })
      return true
    },
    async touchGrant(id, at) {
      const row = grants.get(id)
      if (row) grants.set(id, { ...row, lastUsedAt: at })
    },
    async insertAuthorizationCode(row) { codes.set(row.codeHash, row) },
    async getAuthorizationCode(codeHash) { return codes.get(codeHash) ?? null },
    async markAuthorizationCodeUsed(codeHash, at) {
      const row = codes.get(codeHash)
      if (row) codes.set(codeHash, { ...row, usedAt: at })
    },
    async insertAccessToken(row) { access.set(row.tokenHash, row) },
    async getAccessToken(tokenHash) { return access.get(tokenHash) ?? null },
    async revokeAccessTokensForGrant(grantId, at) {
      for (const [key, row] of access) {
        if (row.grantId === grantId && !row.revokedAt) access.set(key, { ...row, revokedAt: at })
      }
    },
    async touchAccessToken(id, at) {
      for (const [key, row] of access) {
        if (row.id === id) access.set(key, { ...row, lastUsedAt: at } as OauthAccessToken)
      }
    },
    async insertRefreshToken(row) { refresh.set(row.tokenHash, row) },
    async getRefreshToken(tokenHash) { return refresh.get(tokenHash) ?? null },
    async revokeRefreshToken(id, at) {
      for (const [key, row] of refresh) {
        if (row.id === id && !row.revokedAt) refresh.set(key, { ...row, revokedAt: at })
      }
    },
    async revokeRefreshTokensForGrant(grantId, at) {
      for (const [key, row] of refresh) {
        if (row.grantId === grantId && !row.revokedAt) refresh.set(key, { ...row, revokedAt: at })
      }
    },
  }
}
