import { afterEach, describe, expect, it } from "vitest"
import { appAuthOrigin, CANONICAL_SITE_ORIGIN, googleCallbackUrl, googleProviderEnabledFromSettings, safeNextPath } from "./auth-redirect"

describe("safeNextPath", () => {
  it("acepta rutas relativas de la app y rechaza open redirects", () => {
    expect(safeNextPath(null)).toBe("/dashboard")
    expect(safeNextPath("")).toBe("/dashboard")
    expect(safeNextPath("/cuentas")).toBe("/cuentas")
    expect(safeNextPath("/login?modo=registro")).toBe("/login?modo=registro")
    expect(safeNextPath("//evil.example")).toBe("/dashboard")
    expect(safeNextPath("https://evil.example/")).toBe("/dashboard")
    expect(safeNextPath("https://www.migarra.app/cuentas")).toBe("/dashboard")
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard")
    expect(safeNextPath("cuentas")).toBe("/dashboard")
  })
})

describe("googleProviderEnabledFromSettings", () => {
  it("solo es verdadero si el proveedor Google está explícitamente activo", () => {
    expect(googleProviderEnabledFromSettings({ external: { google: true, email: true } })).toBe(true)
    expect(googleProviderEnabledFromSettings({ external: { google: false, email: true } })).toBe(false)
    expect(googleProviderEnabledFromSettings({ external: { email: true } })).toBe(false)
    expect(googleProviderEnabledFromSettings(null)).toBe(false)
    expect(googleProviderEnabledFromSettings({})).toBe(false)
  })
})

describe("orígenes y callback", () => {
  const prevSite = process.env.SITE_URL
  afterEach(() => {
    if (prevSite === undefined) delete process.env.SITE_URL
    else process.env.SITE_URL = prevSite
  })
  it("sin SITE_URL, fuera de development, usa el dominio canónico", () => {
    delete process.env.SITE_URL
    expect(appAuthOrigin()).toBe(CANONICAL_SITE_ORIGIN)
    expect(googleCallbackUrl("/patrimonio")).toBe("https://www.migarra.app/auth/callback?flow=google&next=%2Fpatrimonio")
  })
  it("respeta SITE_URL si está definida", () => {
    process.env.SITE_URL = "https://www.migarra.app/"
    expect(appAuthOrigin()).toBe("https://www.migarra.app")
  })
})
