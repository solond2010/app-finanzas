import { beforeEach, describe, expect, it, vi } from "vitest"
import { randomBytes } from "crypto"
import { createMemoryOauthStore } from "@/lib/oauth/memory-store"
import { s256Challenge } from "@/lib/oauth/pkce"
import { createOauthService } from "@/lib/oauth/service"

const USER = "00000000-0000-4000-8000-000000000001"
const CHATGPT_REDIRECT = "https://chatgpt.com/connector/oauth/tXE273akUn1Z"
const RESOURCE = "https://www.migarra.app/api/mcp"

const getDataContext = vi.fn()
const isSupabaseAuthEnabled = vi.fn()
const userCanUseConnectors = vi.fn()
const getOauthService = vi.fn()

vi.mock("@/lib/server/request-context", () => ({
  getDataContext: () => getDataContext(),
}))

vi.mock("@/lib/auth-mode", () => ({
  isSupabaseAuthEnabled: () => isSupabaseAuthEnabled(),
}))

vi.mock("@/lib/server/connectors-access", () => ({
  userCanUseConnectors: (...args: unknown[]) => userCanUseConnectors(...args),
}))

vi.mock("@/lib/oauth/server", () => ({
  getOauthService: () => getOauthService(),
}))

function verifier() {
  return randomBytes(32).toString("base64url")
}

async function startChatGptConsent() {
  const store = createMemoryOauthStore()
  const oauth = createOauthService(store)
  getOauthService.mockReturnValue(oauth)
  const registered = await oauth.registerClient({
    client_name: "ChatGPT",
    redirect_uris: [CHATGPT_REDIRECT],
    token_endpoint_auth_method: "none",
  })
  if ("error" in registered) throw new Error("registro")
  const proof = verifier()
  const started = await oauth.startAuthorization(USER, {
    client_id: registered.client_id,
    redirect_uri: CHATGPT_REDIRECT,
    response_type: "code",
    scope: "garra",
    resource: RESOURCE,
    code_challenge: s256Challenge(proof),
    code_challenge_method: "S256",
    state: "chatgpt-state-1",
  })
  if ("error" in started || "redirectTo" in started) throw new Error("authorize")
  return { oauth, started, proof, registered }
}

function postConsent(consentId: string, decision: "allow" | "deny") {
  return new Request("https://www.migarra.app/oauth/consent", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ consent: consentId, decision }),
  })
}

describe("POST /oauth/consent con la petición de ChatGPT", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isSupabaseAuthEnabled.mockReturnValue(true)
    getDataContext.mockResolvedValue({ userId: USER, db: {}, email: "prueba@example.com" })
    userCanUseConnectors.mockResolvedValue(true)
  })

  it("al autorizar redirige con 303 GET a la redirect_uri exacta, con code, state y el mismo resource/PKCE", async () => {
    const { oauth, started, proof, registered } = await startChatGptConsent()
    const { POST } = await import("./route")
    const response = await POST(postConsent(started.pending.id, "allow"))
    expect(response.status).toBe(303)
    expect(response.status).not.toBe(307)
    const location = response.headers.get("Location")
    expect(location).toBeTruthy()
    const url = new URL(location!)
    expect(`${url.origin}${url.pathname}`).toBe(CHATGPT_REDIRECT)
    expect(url.searchParams.get("state")).toBe("chatgpt-state-1")
    const code = url.searchParams.get("code")
    expect(code).toMatch(/^gac_/)

    const otherRedirect = await oauth.issueToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${CHATGPT_REDIRECT}/otra`,
      code_verifier: proof,
      client_id: registered.client_id,
    })
    expect(otherRedirect).toMatchObject({ error: "invalid_grant" })

    const tokens = await oauth.issueToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: CHATGPT_REDIRECT,
      code_verifier: proof,
      client_id: registered.client_id,
    })
    if ("error" in tokens) throw new Error(tokens.error_description)
    expect(tokens.access_token.startsWith("gat_")).toBe(true)
    expect(tokens.scope).toBe("garra")
  })

  it("al cancelar también usa 303, sin emitir código", async () => {
    const { started } = await startChatGptConsent()
    const { POST } = await import("./route")
    const response = await POST(postConsent(started.pending.id, "deny"))
    expect(response.status).toBe(303)
    const url = new URL(response.headers.get("Location")!)
    expect(`${url.origin}${url.pathname}`).toBe(CHATGPT_REDIRECT)
    expect(url.searchParams.get("error")).toBe("access_denied")
    expect(url.searchParams.get("code")).toBeNull()
    expect(url.searchParams.get("state")).toBe("chatgpt-state-1")
  })

  it("rechaza un consentimiento inválido con 400 y no redirige", async () => {
    getOauthService.mockReturnValue({ decideConsent: vi.fn() })
    const { POST } = await import("./route")
    const response = await POST(postConsent("no-es-un-uuid", "allow"))
    expect(response.status).toBe(400)
    expect(await response.text()).toContain("consentimiento")
    expect(response.headers.get("Location")).toBeNull()
  })

  it("exige PKCE S256 y la redirect_uri exacta ya en el authorize, como ChatGPT", async () => {
    const store = createMemoryOauthStore()
    const oauth = createOauthService(store)
    const registered = await oauth.registerClient({
      client_name: "ChatGPT",
      redirect_uris: [CHATGPT_REDIRECT],
      token_endpoint_auth_method: "none",
    })
    if ("error" in registered) throw new Error("registro")
    const proof = verifier()
    const noPkce = await oauth.startAuthorization(USER, {
      client_id: registered.client_id,
      redirect_uri: CHATGPT_REDIRECT,
      response_type: "code",
      scope: "garra",
      resource: RESOURCE,
      code_challenge: s256Challenge(proof),
      code_challenge_method: "plain",
      state: "x",
    })
    expect("redirectTo" in noPkce && new URL(noPkce.redirectTo).searchParams.get("error")).toBe("invalid_request")

    const otherUri = await oauth.startAuthorization(USER, {
      client_id: registered.client_id,
      redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
      response_type: "code",
      scope: "garra",
      resource: RESOURCE,
      code_challenge: s256Challenge(proof),
      code_challenge_method: "S256",
    })
    expect(otherUri).toMatchObject({ error: "invalid_request", status: 400 })
  })
})
