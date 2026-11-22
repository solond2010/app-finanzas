import { describe, expect, it } from "vitest"
import { BLACK_FRIDAY_END_UTC, BLACK_FRIDAY_NOTICE, BLACK_FRIDAY_START_UTC } from "./black-friday"
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
    expect(pricingCatalog().faq[1].a).toContain(String(free.maxAccounts))
    expect(pricingCatalog().faq[1].a).toContain(String(free.maxGoals))
  })

  it("lleva «Hazte Pro» a la tarjeta de plan, vía registro si no hay sesión", () => {
    expect(pricingStartHref(false)).toBe("/login?modo=registro")
    expect(pricingStartHref(true)).toBe("/dashboard")
    expect(pricingProHref(true)).toBe("/configuracion#plan")
    expect(pricingProHref(false)).toBe("/login?modo=registro&redirect=%2Fconfiguracion%23plan")
  })

  it("en /precios muestra la oferta del vitalicio solo dentro de la ventana", () => {
    const before = pricingCatalog(new Date(Date.parse(BLACK_FRIDAY_START_UTC) - 1))
    expect(before.lifetimeSalePrice).toBeNull()
    expect(before.lifetimeOffer).toBeNull()
    expect(before.lifetimePrice).toBe(formatPriceEur(PRICES_EUR.pro_lifetime))

    const during = pricingCatalog(new Date("2026-11-28T12:00:00.000Z"))
    expect(during.lifetimePrice).toBe(formatPriceEur(PRICES_EUR.pro_lifetime))
    expect(during.lifetimeSalePrice).toBe(formatPriceEur(9.99))
    expect(during.lifetimeOffer).toEqual({
      listPrice: PRICES_EUR.pro_lifetime,
      salePrice: 9.99,
      notice: BLACK_FRIDAY_NOTICE,
    })

    const after = pricingCatalog(new Date(BLACK_FRIDAY_END_UTC))
    expect(after.lifetimeSalePrice).toBeNull()
    expect(after.lifetimeOffer).toBeNull()
  })
})
