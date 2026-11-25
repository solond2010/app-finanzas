import { describe, expect, it } from "vitest"
import { entitlementsFor, PRICES_EUR } from "./plans"
import {
  formatPriceEur,
  pricingCatalog,
  pricingFeaturesFor,
  pricingProHref,
  pricingStartHref,
} from "./pricing-page"

describe("página de precios", () => {
  it("formatea los precios de PRICES_EUR, sin cifras sueltas", () => {
    const catalog = pricingCatalog()
    expect(catalog.monthlyPrice).toBe(formatPriceEur(PRICES_EUR.pro_monthly))
    expect(catalog.lifetimePrice).toBe(formatPriceEur(PRICES_EUR.pro_lifetime))
    expect(catalog.monthlyPrice).toMatch(/1,99/)
    expect(catalog.lifetimePrice).toMatch(/14,99/)
  })

  it("describe Gratis y Pro a partir de entitlementsFor", () => {
    const free = entitlementsFor("free", true)
    const pro = entitlementsFor("pro", true)
    const freeFeatures = pricingFeaturesFor("free")
    const proFeatures = pricingFeaturesFor("pro")
    expect(freeFeatures.find((item) => item.label.includes(String(free.maxAccounts)))?.included).toBe(true)
    expect(freeFeatures.find((item) => item.label.includes(String(free.maxGoals)))?.included).toBe(true)
    expect(freeFeatures.some((item) => !item.included && item.label.includes("inversiones"))).toBe(true)
    expect(pro.maxAccounts).toBeNull()
    expect(proFeatures.some((item) => item.included && item.label === "Cuentas ilimitadas")).toBe(true)
    expect(proFeatures.some((item) => item.included && item.label === "Inversiones")).toBe(true)
    expect(proFeatures.some((item) => item.included && item.label === "Exportación")).toBe(true)
    expect(pricingCatalog().faq.some((item) => item.a.includes(String(free.maxAccounts)))).toBe(true)
    expect(pricingCatalog().faq.some((item) => item.a.includes(String(free.maxGoals)))).toBe(true)
    expect(pricingCatalog().offerMonthlyTrial).toBe(true)
    expect(pricingCatalog().monthlyBadge).toBe("Primer mes gratis")
    expect(pricingCatalog().monthlyNote).toMatch(/primer mes es gratis/i)
    expect(pricingCatalog().monthlyNote).toContain(formatPriceEur(PRICES_EUR.pro_monthly))
    expect(pricingCatalog({ offerMonthlyTrial: false }).monthlyBadge).toBe("Recomendado")
    expect(pricingCatalog({ offerMonthlyTrial: false }).faq.some((item) => /primer mes/i.test(item.q))).toBe(false)
  })

  it("lleva «Hazte Pro» a la tarjeta de plan, vía registro si no hay sesión", () => {
    expect(pricingStartHref(false)).toBe("/login?modo=registro")
    expect(pricingStartHref(true)).toBe("/dashboard")
    expect(pricingProHref(true)).toBe("/configuracion#plan")
    expect(pricingProHref(false)).toBe("/login?modo=registro&redirect=%2Fconfiguracion%23plan")
  })
})
