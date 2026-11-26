import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { McpConnectCardView } from "@/components/settings/mcp-connect-card"
import { MCP_ENDPOINT_URL, MCP_OAUTH_CONNECTOR_STEPS } from "@/lib/mcp/public"

const sample = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "MCP",
  created_at: "2026-11-25T10:00:00.000Z",
  last_used_at: "2026-11-25T15:00:00.000Z",
}

describe("tarjeta Conectar con ChatGPT/Claude", () => {
  it("muestra la sección, la URL, la ayuda Bearer y el aviso de próximamente mientras el flag esté apagado", () => {
    const html = renderToStaticMarkup(
      <McpConnectCardView tokens={[]} connectorsPublic={false} />,
    )
    expect(html).toContain("Conectar con ChatGPT/Claude")
    expect(html).toContain(MCP_ENDPOINT_URL)
    expect(html).toContain("Authorization: Bearer TU_TOKEN")
    expect(html).toContain("Próximamente")
    expect(html).not.toContain(MCP_OAUTH_CONNECTOR_STEPS[0].text)
    expect(html).toContain("Generar token")
    expect(html).toContain("Aún no tienes tokens personales.")
    expect(html.toLowerCase()).not.toMatch(/moha|mohamed|amin/)
  })

  it("enseña los pasos de ChatGPT y Claude.ai solo si el flag está activo", () => {
    const html = renderToStaticMarkup(
      <McpConnectCardView tokens={[]} connectorsPublic />,
    )
    expect(html).toContain("ChatGPT")
    expect(html).toContain("Claude.ai")
    expect(html).toContain(MCP_OAUTH_CONNECTOR_STEPS[0].text)
    expect(html).not.toContain("Próximamente")
  })

  it("muestra el aviso suave Solo en Pro con enlace a /precios, sin el botón de generar token", () => {
    const html = renderToStaticMarkup(
      <McpConnectCardView tokens={[]} access={false} />,
    )
    expect(html).toContain("Solo en Pro")
    expect(html).toContain("/precios")
    expect(html).not.toContain("Generar token")
    expect(html.toLowerCase()).not.toMatch(/moha|mohamed|amin/)
  })

  it("enseña el token una sola vez, lista tokens y permite revocar conexiones OAuth", () => {
    const html = renderToStaticMarkup(
      <McpConnectCardView
        tokens={[sample]}
        grants={[{ id: "22222222-2222-4222-8222-222222222222", name: "Claude", created_at: "2026-11-25T10:00:00.000Z", last_used_at: null }]}
        newToken="grr_solo-visible-ahora"
      />,
    )
    expect(html).toContain("Copia este token ahora: no se volverá a mostrar.")
    expect(html).toContain("grr_solo-visible-ahora")
    expect(html).toContain("Aplicaciones conectadas")
    expect(html).toContain("Claude")
    expect(html).toContain("Revocar")
    expect(html).not.toContain("Aún no tienes tokens personales.")
    expect(html.toLowerCase()).not.toMatch(/moha|mohamed|amin/)
  })
})
