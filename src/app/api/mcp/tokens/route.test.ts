import { beforeEach, describe, expect, it, vi } from "vitest"

const getDataContext = vi.fn()
const isSupabaseAuthEnabled = vi.fn()
const listActiveMcpTokens = vi.fn()
const countActiveMcpTokens = vi.fn()
const issueMcpToken = vi.fn()
const revokeMcpToken = vi.fn()

vi.mock("@/lib/server/request-context", () => ({
  getDataContext: () => getDataContext(),
  unauthorizedResponse: () => new Response(JSON.stringify({ error: "No has iniciado sesión" }), {
    status: 401,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  }),
}))

vi.mock("@/lib/auth-mode", () => ({
  isSupabaseAuthEnabled: () => isSupabaseAuthEnabled(),
}))

vi.mock("@/lib/mcp/auth", () => ({
  listActiveMcpTokens: (...args: unknown[]) => listActiveMcpTokens(...args),
  countActiveMcpTokens: (...args: unknown[]) => countActiveMcpTokens(...args),
  issueMcpToken: (...args: unknown[]) => issueMcpToken(...args),
  revokeMcpToken: (...args: unknown[]) => revokeMcpToken(...args),
}))

const USER = "00000000-0000-4000-8000-000000000001"
const TOKEN_ID = "11111111-1111-4111-8111-111111111111"

async function body(response: Response) {
  return await response.json() as Record<string, unknown>
}

describe("API /api/mcp/tokens (sesión, sin datos reales)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isSupabaseAuthEnabled.mockReturnValue(true)
    getDataContext.mockResolvedValue({ userId: USER, db: {}, email: "prueba@example.com" })
  })

  it("rechaza si no hay sesión o las cuentas no están activas", async () => {
    const { GET } = await import("./route")
    getDataContext.mockResolvedValueOnce(null)
    expect((await GET()).status).toBe(401)
    isSupabaseAuthEnabled.mockReturnValueOnce(false)
    expect((await GET()).status).toBe(401)
    expect(listActiveMcpTokens).not.toHaveBeenCalled()
  })

  it("lista solo tokens del usuario y nunca devuelve el hash ni el secreto", async () => {
    const item = { id: TOKEN_ID, name: "MCP", created_at: "2026-11-25T10:00:00.000Z", last_used_at: null }
    listActiveMcpTokens.mockResolvedValue([item])
    const { GET } = await import("./route")
    const response = await GET()
    expect(response.status).toBe(200)
    const json = await body(response)
    expect(json.tokens).toEqual([item])
    expect(JSON.stringify(json)).not.toMatch(/token_hash|grr_/)
    expect(listActiveMcpTokens).toHaveBeenCalledWith(USER)
  })

  it("crea un token y lo devuelve una sola vez", async () => {
    countActiveMcpTokens.mockResolvedValue(0)
    issueMcpToken.mockResolvedValue({
      token: "grr_solo-se-ve-ahora",
      item: { id: TOKEN_ID, name: "MCP", created_at: "2026-11-25T10:00:00.000Z", last_used_at: null },
    })
    const { POST } = await import("./route")
    const response = await POST(new Request("http://garra.test/api/mcp/tokens", { method: "POST", body: "{}" }))
    expect(response.status).toBe(200)
    const json = await body(response)
    expect(json.token).toBe("grr_solo-se-ve-ahora")
    expect(issueMcpToken).toHaveBeenCalledWith(USER, "MCP")
  })

  it("respeta el máximo de tokens activos y permite revocar", async () => {
    countActiveMcpTokens.mockResolvedValue(5)
    const { POST, DELETE } = await import("./route")
    const created = await POST(new Request("http://garra.test/api/mcp/tokens", { method: "POST", body: "{}" }))
    expect(created.status).toBe(400)
    expect(issueMcpToken).not.toHaveBeenCalled()

    revokeMcpToken.mockResolvedValue(true)
    const revoked = await DELETE(new Request("http://garra.test/api/mcp/tokens", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: TOKEN_ID }),
    }))
    expect(revoked.status).toBe(200)
    expect(revokeMcpToken).toHaveBeenCalledWith(USER, TOKEN_ID)
  })
})
