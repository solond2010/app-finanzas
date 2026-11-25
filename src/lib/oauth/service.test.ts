import { describe, expect, it } from "vitest"
import { ACCESS_TOKEN_TTL_SECONDS } from "@/lib/oauth/constants"
import { createMemoryOauthStore } from "@/lib/oauth/memory-store"
import { isAllowedRedirectUri } from "@/lib/oauth/redirect"
import { s256Challenge } from "@/lib/oauth/pkce"
import { createOauthService } from "@/lib/oauth/service"
import { randomBytes } from "crypto"

const USER = "00000000-0000-4000-8000-000000000001"

function verifier() {
  return randomBytes(32).toString("base64url")
}

function serviceAt(now: Date) {
  const store = createMemoryOauthStore()
  return { store, oauth: createOauthService(store, () => now) }
}

describe("redirect_uri de registro", () => {
  it("acepta https y localhost, y rechaza http remoto o esquemas raros", () => {
    expect(isAllowedRedirectUri("https://chatgpt.com/connector/oauth/callback")).toBe(true)
    expect(isAllowedRedirectUri("http://localhost:1455/callback")).toBe(true)
    expect(isAllowedRedirectUri("http://127.0.0.1/cb")).toBe(true)
    expect(isAllowedRedirectUri("http://evil.example/cb")).toBe(false)
    expect(isAllowedRedirectUri("https://evil.example@https://garra.test")).toBe(false)
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false)
    expect(isAllowedRedirectUri("chatgpt://callback")).toBe(false)
  })

  it("rechaza el registro si alguna redirect_uri no está permitida", async () => {
    const { oauth } = serviceAt(new Date("2026-11-26T00:00:00.000Z"))
    const result = await oauth.registerClient({
      client_name: "Mal",
      redirect_uris: ["http://evil.example/cb"],
    })
    expect(result).toMatchObject({ error: "invalid_client_metadata", status: 400 })
  })
})

describe("PKCE S256 y redirect_uri en el intercambio", () => {
  it("emite tokens con un verifier correcto y rechaza uno distinto", async () => {
    const now = new Date("2026-11-26T00:00:00.000Z")
    const { oauth } = serviceAt(now)
    const redirect = "https://claude.ai/api/mcp/auth/callback"
    const registered = await oauth.registerClient({ client_name: "Claude", redirect_uris: [redirect] })
    if ("error" in registered) throw new Error("registro")
    const proof = verifier()
    const started = await oauth.startAuthorization(USER, {
      client_id: registered.client_id,
      redirect_uri: redirect,
      response_type: "code",
      code_challenge: s256Challenge(proof),
      code_challenge_method: "S256",
      state: "abc",
    })
    if ("error" in started || "redirectTo" in started) throw new Error("authorize")
    const decided = await oauth.decideConsent(USER, started.pending.id, true)
    if ("error" in decided) throw new Error("consent")
    const code = new URL(decided.redirectTo).searchParams.get("code")
    expect(code).toBeTruthy()
    expect(new URL(decided.redirectTo).searchParams.get("state")).toBe("abc")

    const denied = await oauth.issueToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      code_verifier: verifier(),
      client_id: registered.client_id,
    })
    expect(denied).toMatchObject({ error: "invalid_grant" })

    const tokens = await oauth.issueToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      code_verifier: proof,
      client_id: registered.client_id,
    })
    if ("error" in tokens) throw new Error(tokens.error_description)
    expect(tokens.access_token.startsWith("gat_")).toBe(true)
    expect(tokens.refresh_token.startsWith("grt_")).toBe(true)
    expect(tokens.expires_in).toBe(ACCESS_TOKEN_TTL_SECONDS)
    expect(tokens.token_type).toBe("Bearer")

    const reused = await oauth.issueToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      code_verifier: proof,
      client_id: registered.client_id,
    })
    expect(reused).toMatchObject({ error: "invalid_grant" })
  })

  it("exige S256 y que redirect_uri coincida con la del authorize", async () => {
    const { oauth } = serviceAt(new Date("2026-11-26T00:00:00.000Z"))
    const redirect = "http://localhost:8787/cb"
    const other = "http://localhost:8787/other"
    const registered = await oauth.registerClient({ redirect_uris: [redirect, other] })
    if ("error" in registered) throw new Error("registro")
    const noS256 = await oauth.startAuthorization(USER, {
      client_id: registered.client_id,
      redirect_uri: redirect,
      response_type: "code",
      code_challenge: s256Challenge(verifier()),
      code_challenge_method: "plain",
    })
    expect("redirectTo" in noS256 && noS256.redirectTo.includes("error=")).toBe(true)

    const proof = verifier()
    const started = await oauth.startAuthorization(USER, {
      client_id: registered.client_id,
      redirect_uri: redirect,
      response_type: "code",
      code_challenge: s256Challenge(proof),
      code_challenge_method: "S256",
    })
    if ("error" in started || "redirectTo" in started) throw new Error("authorize")
    const decided = await oauth.decideConsent(USER, started.pending.id, true)
    if ("error" in decided) throw new Error("consent")
    const code = new URL(decided.redirectTo).searchParams.get("code")
    const mismatch = await oauth.issueToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: other,
      code_verifier: proof,
      client_id: registered.client_id,
    })
    expect(mismatch).toMatchObject({ error: "invalid_grant", error_description: "redirect_uri no coincide" })
  })
})

describe("caducidad", () => {
  it("rechaza un código, un access token y un refresh token caducados", async () => {
    let now = new Date("2026-11-26T00:00:00.000Z")
    const store = createMemoryOauthStore()
    const oauth = createOauthService(store, () => now)
    const redirect = "https://chatgpt.com/callback"
    const registered = await oauth.registerClient({ client_name: "ChatGPT", redirect_uris: [redirect] })
    if ("error" in registered) throw new Error("registro")
    const proof = verifier()
    const started = await oauth.startAuthorization(USER, {
      client_id: registered.client_id,
      redirect_uri: redirect,
      response_type: "code",
      code_challenge: s256Challenge(proof),
      code_challenge_method: "S256",
    })
    if ("error" in started || "redirectTo" in started) throw new Error("authorize")
    const decided = await oauth.decideConsent(USER, started.pending.id, true)
    if ("error" in decided) throw new Error("consent")
    const code = new URL(decided.redirectTo).searchParams.get("code")

    now = new Date("2026-11-26T00:11:00.000Z")
    const expiredCode = await oauth.issueToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      code_verifier: proof,
      client_id: registered.client_id,
    })
    expect(expiredCode).toMatchObject({ error: "invalid_grant", error_description: "El código de autorización ha caducado" })

    now = new Date("2026-11-26T00:00:00.000Z")
    const started2 = await oauth.startAuthorization(USER, {
      client_id: registered.client_id,
      redirect_uri: redirect,
      response_type: "code",
      code_challenge: s256Challenge(proof),
      code_challenge_method: "S256",
    })
    if ("error" in started2 || "redirectTo" in started2) throw new Error("authorize2")
    const decided2 = await oauth.decideConsent(USER, started2.pending.id, true)
    if ("error" in decided2) throw new Error("consent2")
    const code2 = new URL(decided2.redirectTo).searchParams.get("code")
    const tokens = await oauth.issueToken({
      grant_type: "authorization_code",
      code: code2,
      redirect_uri: redirect,
      code_verifier: proof,
      client_id: registered.client_id,
    })
    if ("error" in tokens) throw new Error(tokens.error_description)
    expect(await oauth.resolveAccessToken(tokens.access_token)).toMatchObject({ userId: USER })

    now = new Date("2026-11-26T00:16:00.000Z")
    expect(await oauth.resolveAccessToken(tokens.access_token)).toBeNull()

    const expiredRefresh = await oauth.issueToken({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: registered.client_id,
    })
    // 16 minutes later the refresh token (30 days) is still valid
    if ("error" in expiredRefresh) throw new Error(expiredRefresh.error_description)
    expect(expiredRefresh.access_token).not.toBe(tokens.access_token)
    expect(await oauth.resolveAccessToken(tokens.access_token)).toBeNull()
    expect(await oauth.resolveAccessToken(expiredRefresh.access_token)).toMatchObject({ userId: USER })

    now = new Date("2027-01-01T00:00:00.000Z")
    const later = await oauth.issueToken({
      grant_type: "refresh_token",
      refresh_token: expiredRefresh.refresh_token,
      client_id: registered.client_id,
    })
    expect(later).toMatchObject({ error: "invalid_grant", error_description: "El refresh token ha caducado" })
  })

  it("deja de resolver el access token si se revoca la conexión", async () => {
    const { oauth } = serviceAt(new Date("2026-11-26T00:00:00.000Z"))
    const redirect = "https://example.com/cb"
    const registered = await oauth.registerClient({ redirect_uris: [redirect] })
    if ("error" in registered) throw new Error("registro")
    const proof = verifier()
    const started = await oauth.startAuthorization(USER, {
      client_id: registered.client_id,
      redirect_uri: redirect,
      response_type: "code",
      code_challenge: s256Challenge(proof),
      code_challenge_method: "S256",
    })
    if ("error" in started || "redirectTo" in started) throw new Error("authorize")
    const decided = await oauth.decideConsent(USER, started.pending.id, true)
    if ("error" in decided) throw new Error("consent")
    const code = new URL(decided.redirectTo).searchParams.get("code")
    const tokens = await oauth.issueToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      code_verifier: proof,
      client_id: registered.client_id,
    })
    if ("error" in tokens) throw new Error(tokens.error_description)
    const grants = await oauth.listGrants(USER)
    expect(grants).toHaveLength(1)
    expect(await oauth.revokeGrant(USER, grants[0].id)).toBe(true)
    expect(await oauth.resolveAccessToken(tokens.access_token)).toBeNull()
    const refreshed = await oauth.issueToken({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: registered.client_id,
    })
    expect(refreshed).toMatchObject({ error: "invalid_grant" })
  })
})
