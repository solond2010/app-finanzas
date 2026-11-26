import { describe, expect, it } from "vitest"
import { BLACK_FRIDAY_END_UTC, BLACK_FRIDAY_NOTICE, BLACK_FRIDAY_START_UTC } from "./black-friday"
import { entitlementsFor, PRICES_EUR } from "./plans"
import {
  formatPriceEur,
  pricingCatalog,
  pricingFeaturesFor,
  pricingNowFromPreviewQuery,
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
    expect(freeFeatures.some((item) => item.included && item.label === "Importar CSV")).toBe(true)
    expect(freeFeatures.some((item) => item.included && item.label.includes("Puntuación financiera"))).toBe(true)
    expect(freeFeatures.some((item) => !item.included && item.label === "MCP (ChatGPT y Claude)")).toBe(true)
    expect(freeFeatures.some((item) => !item.included && item.label === "Atajo de iPhone")).toBe(true)
    expect(proFeatures.some((item) => item.included && item.label === "MCP (ChatGPT y Claude)")).toBe(true)
    expect(proFeatures.some((item) => item.included && item.label === "Atajo de iPhone")).toBe(true)
    expect(pricingCatalog().connectorsNote).toMatch(/conservas/)
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

  it("en /precios muestra la oferta del vitalicio solo dentro de la ventana", () => {
    const before = pricingCatalog({ now: new Date(Date.parse(BLACK_FRIDAY_START_UTC) - 1) })
    expect(before.lifetimeSalePrice).toBeNull()
    expect(before.lifetimeOffer).toBeNull()
    expect(before.lifetimePrice).toBe(formatPriceEur(PRICES_EUR.pro_lifetime))

    const during = pricingCatalog({ now: new Date("2026-11-28T12:00:00.000Z") })
    expect(during.lifetimePrice).toBe(formatPriceEur(PRICES_EUR.pro_lifetime))
    expect(during.lifetimeSalePrice).toBe(formatPriceEur(9.99))
    expect(during.lifetimeOffer).toEqual({
      listPrice: PRICES_EUR.pro_lifetime,
      salePrice: 9.99,
      notice: BLACK_FRIDAY_NOTICE,
    })

    const after = pricingCatalog({ now: new Date(BLACK_FRIDAY_END_UTC) })
    expect(after.lifetimeSalePrice).toBeNull()
    expect(after.lifetimeOffer).toBeNull()

    const atStart = pricingCatalog({ now: new Date(BLACK_FRIDAY_START_UTC) })
    expect(atStart.lifetimeSalePrice).toBe(formatPriceEur(9.99))
    expect(atStart.lifetimeOffer?.notice).toBe(BLACK_FRIDAY_NOTICE)
    const justBefore2100 = pricingCatalog({ now: new Date("2026-11-26T19:59:59.999Z") })
    expect(justBefore2100.lifetimeSalePrice).toBeNull()
    expect(justBefore2100.lifetimePrice).toBe(formatPriceEur(PRICES_EUR.pro_lifetime))
    const at2100 = pricingCatalog({ now: new Date("2026-11-26T20:00:00.000Z") })
    expect(at2100.lifetimeSalePrice).toBe(formatPriceEur(9.99))
    expect(at2100.lifetimePrice).toBe(formatPriceEur(PRICES_EUR.pro_lifetime))
  })
})

describe("hora simulada de /precios en preview", () => {
  it("solo admite ?ahora= en preview y no cambia la ventana del Black Friday", () => {
    const atStart = "2026-11-26T20:00:00.000Z"
    expect(pricingNowFromPreviewQuery({ VERCEL_ENV: "production" }, atStart)).toBeUndefined()
    expect(pricingNowFromPreviewQuery({ VERCEL_ENV: "preview" }, atStart)?.toISOString()).toBe(atStart)
    expect(pricingNowFromPreviewQuery({ VERCEL_ENV: "preview" }, "no-es-una-fecha")).toBeUndefined()
    const catalog = pricingCatalog({ now: pricingNowFromPreviewQuery({ VERCEL_ENV: "preview" }, atStart) })
    expect(catalog.lifetimePrice).toBe(formatPriceEur(PRICES_EUR.pro_lifetime))
    expect(catalog.lifetimeSalePrice).toBe(formatPriceEur(9.99))
  })
})
