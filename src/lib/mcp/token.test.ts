import { describe, expect, it } from "vitest"
import { bearerFromRequest, generateMcpToken, hashesEqual, hashMcpToken, isMcpTokenFormat, MCP_TOKEN_PREFIX } from "@/lib/mcp/token"

describe("token MCP", () => {
  it("genera un token con prefijo y lo hashea de forma determinista", () => {
    const token = generateMcpToken()
    expect(token.startsWith(MCP_TOKEN_PREFIX)).toBe(true)
    expect(isMcpTokenFormat(token)).toBe(true)
    expect(hashMcpToken(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashMcpToken(token)).toBe(hashMcpToken(token))
    expect(hashMcpToken(token)).not.toBe(hashMcpToken(generateMcpToken()))
  })

  it("no acepta un texto arbitrario como token", () => {
    expect(isMcpTokenFormat("")).toBe(false)
    expect(isMcpTokenFormat("Bearer abc")).toBe(false)
    expect(isMcpTokenFormat("grr_short")).toBe(false)
  })

  it("extrae el Bearer del request", () => {
    expect(bearerFromRequest(new Request("http://local/api/mcp"))).toBeNull()
    expect(bearerFromRequest(new Request("http://local/api/mcp", { headers: { authorization: "Bearer grr_abc" } }))).toBe("grr_abc")
    expect(bearerFromRequest(new Request("http://local/api/mcp", { headers: { Authorization: "bearer grr_xyz" } }))).toBe("grr_xyz")
  })

  it("compara hashes en tiempo constante", () => {
    const hash = hashMcpToken("grr_ejemplo-de-token-con-suficiente-longitud")
    expect(hashesEqual(hash, hash)).toBe(true)
    expect(hashesEqual(hash, hashMcpToken("otro"))).toBe(false)
  })
})
