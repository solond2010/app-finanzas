import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { OauthConsentForm } from "@/components/oauth/consent-form"

describe("pantalla de consentimiento OAuth", () => {
  it("muestra la marca Garra y no incluye nombres personales", () => {
    const html = renderToStaticMarkup(
      <OauthConsentForm consentId="11111111-1111-4111-8111-111111111111" clientName="Claude" email="prueba@example.com" />,
    )
    expect(html).toContain("¿Conectar con Garra?")
    expect(html).toContain("Claude")
    expect(html).toContain("Autorizar")
    expect(html).toContain("Cancelar")
    expect(html).toContain("prueba@example.com")
    expect(html.toLowerCase()).not.toMatch(/moha|mohamed|amin/)
  })
})
