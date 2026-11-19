import { describe, expect, it } from "vitest"
import {
  canManageStripeSubscription,
  decideBillingPortal,
  formatProUntil,
  isCompatiblePortalConfiguration,
  pickPortalConfiguration,
} from "./portal-policy"

const monthly = {
  plan: "pro",
  source: "stripe",
  subscription_status: "active",
  stripe_customer_id: "cus_own",
  cancel_at_period_end: false,
}

describe("canManageStripeSubscription", () => {
  it("solo deja gestionar un mensual de Stripe con customer propio", () => {
    expect(canManageStripeSubscription(monthly)).toBe(true)
    expect(canManageStripeSubscription({ ...monthly, subscription_status: "trialing" })).toBe(true)
    expect(canManageStripeSubscription({ ...monthly, subscription_status: "past_due" })).toBe(true)
    expect(canManageStripeSubscription({ ...monthly, cancel_at_period_end: true })).toBe(true)
  })

  it("no muestra el portal a quien no paga un mensual o ya es vitalicio", () => {
    expect(canManageStripeSubscription(null)).toBe(false)
    expect(canManageStripeSubscription({ ...monthly, stripe_customer_id: null })).toBe(false)
    expect(canManageStripeSubscription({ ...monthly, subscription_status: "canceled", cancel_at_period_end: false })).toBe(false)
    expect(canManageStripeSubscription({ plan: "founder", source: "stripe", subscription_status: "paid", stripe_customer_id: "cus_own" })).toBe(false)
    expect(canManageStripeSubscription({ plan: "pro", source: "first_fifty", subscription_status: "active", stripe_customer_id: "cus_own" })).toBe(false)
    expect(canManageStripeSubscription({ plan: "pro", source: "admin_grant", subscription_status: "active", stripe_customer_id: "cus_own" })).toBe(false)
    expect(canManageStripeSubscription({ plan: "pro", source: "early_access", stripe_customer_id: "cus_own" })).toBe(false)
    expect(canManageStripeSubscription({ plan: "pro", source: "manual", stripe_customer_id: "cus_own" })).toBe(false)
    expect(canManageStripeSubscription({ plan: "free", source: "stripe", subscription_status: "canceled", stripe_customer_id: "cus_own" })).toBe(false)
  })
})

describe("decideBillingPortal", () => {
  it("exige sesión y no crea nada si no hay suscripción gestionable", () => {
    expect(decideBillingPortal({ authenticated: false, paymentsEnabled: true, row: monthly })).toMatchObject({ ok: false, status: 401 })
    expect(decideBillingPortal({ authenticated: true, paymentsEnabled: false, row: monthly })).toMatchObject({ ok: false, status: 404 })
    const denied = decideBillingPortal({ authenticated: true, paymentsEnabled: true, row: { plan: "free", source: "stripe" } })
    expect(denied).toMatchObject({ ok: false, status: 409 })
    expect(decideBillingPortal({ authenticated: true, paymentsEnabled: true, row: monthly })).toEqual({ ok: true, customerId: "cus_own" })
  })

  it("ignora un customer enviado por el cliente y usa solo el de la fila", () => {
    const decided = decideBillingPortal({ authenticated: true, paymentsEnabled: true, row: monthly })
    expect(decided.ok && decided.customerId).toBe("cus_own")
  })
})

describe("formatProUntil", () => {
  it("escribe Pro hasta el DD/MM en hora de Madrid", () => {
    expect(formatProUntil("2026-12-05T23:30:00.000Z")).toBe("Pro hasta el 06/12")
    expect(formatProUntil(null)).toBeNull()
    expect(formatProUntil("no-es-fecha")).toBeNull()
  })
})

describe("configuración del portal", () => {
  const good = {
    id: "bpc_ok",
    active: true,
    metadata: { app: "garra_customer_portal" },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: { enabled: false },
    },
  }

  it("acepta cancelar a fin de periodo, pago y facturas, y rechaza el cambio de plan", () => {
    expect(isCompatiblePortalConfiguration(good)).toBe(true)
    expect(isCompatiblePortalConfiguration({ ...good, features: { ...good.features, subscription_update: { enabled: true } } })).toBe(false)
    expect(isCompatiblePortalConfiguration({ ...good, features: { ...good.features, subscription_cancel: { enabled: true, mode: "immediately" } } })).toBe(false)
    expect(isCompatiblePortalConfiguration({ ...good, active: false })).toBe(false)
  })

  it("solo reutiliza la configuración de Garra, no otra del mismo tipo", () => {
    const other = { ...good, id: "bpc_other", metadata: {} }
    expect(pickPortalConfiguration([other, good])).toBe("bpc_ok")
    expect(pickPortalConfiguration([other])).toBeNull()
    expect(pickPortalConfiguration([])).toBeNull()
  })
})
