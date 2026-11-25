import { describe, expect, it } from "vitest"
import { formatMcpTokenDate, MCP_ENDPOINT_URL } from "@/lib/mcp/public"

describe("textos públicos del MCP", () => {
  it("usa la URL de producción y no incluye nombres personales", () => {
    expect(MCP_ENDPOINT_URL).toBe("https://www.migarra.app/api/mcp")
    expect(MCP_ENDPOINT_URL.toLowerCase()).not.toMatch(/moha|mohamed|amin/)
  })

  it("formatea fechas en Europe/Madrid y deja 'nunca' si no hay uso", () => {
    expect(formatMcpTokenDate(null)).toBe("nunca")
    expect(formatMcpTokenDate("2026-11-25T10:00:00.000Z")).toContain("2026")
    expect(formatMcpTokenDate("2026-11-25T10:00:00.000Z")).toMatch(/11:00/)
  })
})
