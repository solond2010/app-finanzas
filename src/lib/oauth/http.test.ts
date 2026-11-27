import { describe, expect, it } from "vitest"
import { oauthClientRedirect } from "@/lib/oauth/http"

describe("redirección OAuth tras el consentimiento", () => {
  it("usa 303 para que el navegador haga GET a la redirect_uri, no 307 que repetiría el POST", () => {
    const target = "https://chatgpt.com/connector/oauth/tXE273akUn1Z?code=gac_ejemplo&state=abc"
    const response = oauthClientRedirect(target)
    expect(response.status).toBe(303)
    expect(response.headers.get("Location")).toBe(target)
  })
})
