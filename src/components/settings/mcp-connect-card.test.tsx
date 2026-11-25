import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { McpConnectCardView } from "@/components/settings/mcp-connect-card"
import { MCP_ENDPOINT_URL } from "@/lib/mcp/public"

const sample = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "MCP",
  created_at: "2026-11-25T10:00:00.000Z",
  last_used_at: "2026-11-25T15:00:00.000Z",
}

function render(html: string) {
  return html
}

describe("tarjeta Conectar con ChatGPT/Claude", () => {
  it("muestra la sección, la URL, la ayuda Bearer y el aviso de próximamente", () => {
    const html = render(renderToStaticMarkup(
      <McpConnectCardView tokens={[]} />,
    ))
    expect(html).toContain("Conectar con ChatGPT/Claude")
    expect(html).toContain(MCP_ENDPOINT_URL)
    expect(html).toContain("Authorization: Bearer TU_TOKEN")
    expect(html).toContain("Próximamente")
    expect(html).toContain("Generar token")
    expect(html).toContain("Aún no tienes tokens.")
    expect(html.toLowerCase()).not.toMatch(/moha|mohamed|amin/)
  })

  it("enseña el token una sola vez y lista los activos con fechas", () => {
    const html = render(renderToStaticMarkup(
      <McpConnectCardView
        tokens={[sample]}
        newToken="grr_solo-visible-ahora"
      />,
    ))
    expect(html).toContain("Copia este token ahora: no se volverá a mostrar.")
    expect(html).toContain("grr_solo-visible-ahora")
    expect(html).toContain("Ya lo he copiado")
    expect(html).toContain("Creado")
    expect(html).toContain("Último uso")
    expect(html).toContain("Revocar")
    expect(html).not.toContain("Aún no tienes tokens.")
    expect(html.toLowerCase()).not.toMatch(/moha|mohamed|amin/)
  })
})
