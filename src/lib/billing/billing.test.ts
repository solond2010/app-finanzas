import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { canHaveAccounts, entitlementsFor, firstFiftyGrant, isCheckoutOption, isFirstFiftyUser, isLifetimeAccess, normalizeCheckoutOption, PRICES_EUR, subscriptionGivesPro, type RankedUser } from "./plans"
import { verifyStripeSignature } from "./stripe-signature"
import { decideCheckout } from "./checkout-policy"
import { allowStripeEventOnLedger, paymentsEnabledFor } from "./env-policy"
import { decideStripeWebhook, mergePlanPatch, withCheckoutPeriodEnd } from "./webhook-plan"

describe("planes", () => {
  it("expone los precios acordados y no ofrece el plan anual", () => {
    expect(PRICES_EUR.pro_monthly).toBe(1.99)
    expect(PRICES_EUR.pro_lifetime).toBe(14.99)
    expect(normalizeCheckoutOption("pro_yearly")).toBeNull()
    expect(isCheckoutOption("pro_yearly")).toBe(false)
    expect(normalizeCheckoutOption("founder")).toBe("pro_lifetime")
    expect(normalizeCheckoutOption("pro_lifetime")).toBe("pro_lifetime")
  })
  it("con los pagos apagados nadie tiene límites", () => {
    expect(entitlementsFor("free", false).maxAccounts).toBeNull()
    expect(canHaveAccounts("free", false, 50)).toBe(true)
  })
  it("con los pagos activos el plan gratis tiene 3 cuentas y Pro/vitalicio ilimitadas", () => {
    expect(canHaveAccounts("free", true, 3)).toBe(true)
    expect(canHaveAccounts("free", true, 4)).toBe(false)
    expect(entitlementsFor("free", true).investments).toBe(false)
    expect(entitlementsFor("free", true).netWorthHistory).toBe(false)
    expect(entitlementsFor("free", true).advancedAnalytics).toBe(false)
    expect(entitlementsFor("free", true).export).toBe(false)
    expect(canHaveAccounts("pro", true, 40)).toBe(true)
    expect(entitlementsFor("founder", true).export).toBe(true)
  })
  it("estados de suscripción que dan Pro", () => {
    expect(subscriptionGivesPro("active")).toBe(true)
    expect(subscriptionGivesPro("trialing")).toBe(true)
    expect(subscriptionGivesPro("past_due")).toBe(true)
    expect(subscriptionGivesPro("canceled")).toBe(false)
    expect(subscriptionGivesPro(null)).toBe(false)
  })
})

describe("primeros 50", () => {
  const users: RankedUser[] = Array.from({ length: 54 }, (_, i) => ({
    id: `u${String(i + 1).padStart(2, "0")}`,
    created_at: `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`,
  }))
  it("elige de forma determinista por created_at e id, sin filtro del cliente", () => {
    expect(isFirstFiftyUser("u01", users)).toBe(true)
    expect(isFirstFiftyUser("u50", users)).toBe(true)
    expect(isFirstFiftyUser("u51", users)).toBe(false)
    expect(isFirstFiftyUser("u54", users)).toBe(false)
    const shuffled = [...users].reverse()
    expect(isFirstFiftyUser("u50", shuffled)).toBe(true)
  })
  it("desempata por id si coinciden en created_at", () => {
    const tied: RankedUser[] = [
      { id: "b", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "a", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "c", created_at: "2026-01-01T00:00:01.000Z" },
    ]
    expect(isFirstFiftyUser("a", tied, 2)).toBe(true)
    expect(isFirstFiftyUser("b", tied, 2)).toBe(true)
    expect(isFirstFiftyUser("c", tied, 2)).toBe(false)
  })
  it("concede Pro a un elegible sin plan y no degrada derechos previos", () => {
    expect(firstFiftyGrant(null, true)).toEqual({ plan: "pro", source: "first_fifty" })
    expect(firstFiftyGrant({ plan: "free", source: "stripe" }, true)).toEqual({ plan: "pro", source: "first_fifty" })
    expect(firstFiftyGrant({ plan: "pro", source: "early_access" }, true)).toBe("keep")
    expect(firstFiftyGrant({ plan: "founder", source: "stripe" }, true)).toBe("keep")
    expect(firstFiftyGrant({ plan: "pro", source: "manual" }, true)).toBe("keep")
    expect(firstFiftyGrant({ plan: "pro", source: "stripe" }, true)).toBe("keep")
    expect(firstFiftyGrant(null, false)).toBe("keep")
  })
})

describe("interruptor de pagos y aislamiento test/live", () => {
  it("está apagado si PAYMENTS_ENABLED no es true", () => {
    expect(paymentsEnabledFor({ PAYMENTS_ENABLED: "false", VERCEL_ENV: "production" })).toBe(false)
    expect(paymentsEnabledFor({})).toBe(false)
  })
  it("en producción no activa el checkout con una clave de test", () => {
    expect(paymentsEnabledFor({ PAYMENTS_ENABLED: "true", VERCEL_ENV: "production", STRIPE_SECRET_KEY: "sk_test_x" })).toBe(false)
    expect(paymentsEnabledFor({ PAYMENTS_ENABLED: "true", VERCEL_ENV: "preview", STRIPE_SECRET_KEY: "sk_test_x" })).toBe(true)
  })
  it("una clave live exige STRIPE_ALLOW_LIVE", () => {
    expect(paymentsEnabledFor({ PAYMENTS_ENABLED: "true", STRIPE_SECRET_KEY: "sk_live_x" })).toBe(false)
    expect(paymentsEnabledFor({ PAYMENTS_ENABLED: "true", STRIPE_SECRET_KEY: "sk_live_x", STRIPE_ALLOW_LIVE: "true" })).toBe(true)
  })
  it("los eventos de test no se aplican al ledger de producción", () => {
    expect(allowStripeEventOnLedger(false, { VERCEL_ENV: "production" }).apply).toBe(false)
    expect(allowStripeEventOnLedger(false, { VERCEL_ENV: "preview" }).apply).toBe(false)
    expect(allowStripeEventOnLedger(false, { VERCEL_ENV: "preview", STRIPE_ALLOW_TEST_LEDGER: "true" }).apply).toBe(true)
    expect(allowStripeEventOnLedger(true, { VERCEL_ENV: "production" }).apply).toBe(false)
    expect(allowStripeEventOnLedger(true, { VERCEL_ENV: "production", STRIPE_ALLOW_LIVE: "true" }).apply).toBe(true)
  })
})

describe("checkout: autoridad del servidor", () => {
  it("exige usuario autenticado", () => {
    const denied = decideCheckout({ authenticated: false, body: { option: "pro_monthly" }, currentPlan: "free" })
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.status).toBe(401)
  })
  it("ignora importe, price_id y el plan anual enviado por el cliente", () => {
    const ignored = decideCheckout({
      authenticated: true,
      body: { option: "pro_monthly", amount: 0.01, price: "price_hack", price_id: "price_hack", currency: "usd" },
      currentPlan: "free",
    })
    expect(ignored).toEqual({ ok: true, option: "pro_monthly" })
    const yearly = decideCheckout({ authenticated: true, body: { option: "pro_yearly" }, currentPlan: "free" })
    expect(yearly.ok).toBe(false)
    if (!yearly.ok) expect(yearly.status).toBe(400)
  })
  it("no deja comprar otra vez a quien ya tiene Pro o vitalicio", () => {
    expect(decideCheckout({ authenticated: true, body: { option: "pro_lifetime" }, currentPlan: "pro" }).ok).toBe(false)
    expect(decideCheckout({ authenticated: true, body: { option: "founder" }, currentPlan: "founder" }).ok).toBe(false)
  })
})

describe("webhook de Stripe", () => {
  const isolated = { VERCEL_ENV: "preview", STRIPE_ALLOW_TEST_LEDGER: "true" }
  const production = { VERCEL_ENV: "production" }

  it("el evento de test no aplica en producción aunque el pago sea válido", () => {
    const decision = decideStripeWebhook({
      id: "evt_test",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { payment_status: "paid", mode: "subscription", client_reference_id: "user-1", customer: "cus_1", subscription: "sub_1" } },
    }, production)
    expect(decision.action).toBe("ignore")
    if (decision.action === "ignore") expect(decision.reason).toMatch(/ledger de producción/)
  })

  it("concede Pro mensual tras un checkout pagado en un ledger de test aislado", () => {
    const decision = decideStripeWebhook({
      id: "evt_month",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { payment_status: "paid", mode: "subscription", client_reference_id: "user-1", customer: "cus_1", subscription: "sub_1" } },
    }, isolated)
    expect(decision).toMatchObject({ action: "apply", userId: "user-1", patch: { plan: "pro", source: "stripe", stripe_subscription_id: "sub_1" } })
  })

  it("concede Pro vitalicio en un pago único y no en un pago fallido", () => {
    const paid = decideStripeWebhook({
      id: "evt_life",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { payment_status: "paid", mode: "payment", client_reference_id: "user-2", customer: "cus_2" } },
    }, isolated)
    expect(paid).toMatchObject({ action: "apply", userId: "user-2", patch: { plan: "founder", source: "stripe", subscription_status: "paid" } })
    const unpaid = decideStripeWebhook({
      id: "evt_unpaid",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { payment_status: "unpaid", mode: "payment", client_reference_id: "user-2" } },
    }, isolated)
    expect(unpaid.action).toBe("ignore")
    const failed = decideStripeWebhook({
      id: "evt_fail",
      type: "checkout.session.async_payment_failed",
      livemode: false,
      data: { object: { client_reference_id: "user-2" } },
    }, isolated)
    expect(failed.action).toBe("ignore")
  })

  it("tras cancelar o acabar el periodo, el mensual pasa a gratis y el vitalicio se conserva", () => {
    const canceled = decideStripeWebhook({
      id: "evt_cancel",
      type: "customer.subscription.deleted",
      livemode: false,
      data: { object: { id: "sub_1", metadata: { user_id: "user-1" }, status: "canceled", current_period_end: 1_800_000_000 } },
    }, isolated)
    expect(canceled).toMatchObject({ action: "apply", userId: "user-1", patch: { plan: "free", source: "stripe", subscription_status: "canceled" } })
    if (canceled.action === "apply") {
      const monthly = mergePlanPatch({ plan: "pro", source: "stripe" }, canceled.patch)
      expect(monthly.plan).toBe("free")
      const early = mergePlanPatch({ plan: "pro", source: "early_access" }, canceled.patch)
      expect(early.plan).toBeUndefined()
      expect(early.source).toBeUndefined()
      const first = mergePlanPatch({ plan: "pro", source: "first_fifty" }, canceled.patch)
      expect(first.plan).toBeUndefined()
      const life = mergePlanPatch({ plan: "founder", source: "stripe" }, canceled.patch)
      expect(life.plan).toBeUndefined()
      expect(isLifetimeAccess("pro", "early_access")).toBe(true)
    }
  })

  it("rellena current_period_end en el checkout mensual si la suscripción viene expandida", () => {
    const end = 1_800_000_000
    const decision = decideStripeWebhook({
      id: "evt_month_exp",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { payment_status: "paid", mode: "subscription", client_reference_id: "user-1", customer: "cus_1", subscription: { id: "sub_1", items: { data: [{ current_period_end: end }] } } } },
    }, isolated)
    expect(decision).toMatchObject({ action: "apply", userId: "user-1", patch: { plan: "pro", stripe_subscription_id: "sub_1", current_period_end: new Date(end * 1000).toISOString() } })
  })

  it("si el checkout solo trae el id, el periodo se completa al consultar la suscripción; el vitalicio no lleva fecha", () => {
    const monthly = decideStripeWebhook({
      id: "evt_month_id",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { payment_status: "paid", mode: "subscription", client_reference_id: "user-1", customer: "cus_1", subscription: "sub_1" } },
    }, isolated)
    expect(monthly.action).toBe("apply")
    if (monthly.action === "apply") {
      expect(monthly.patch.current_period_end).toBeUndefined()
      const filled = withCheckoutPeriodEnd(monthly.patch, { items: { data: [{ current_period_end: 1_800_000_000 }] } })
      expect(filled.current_period_end).toBe(new Date(1_800_000_000 * 1000).toISOString())
      expect(withCheckoutPeriodEnd(monthly.patch, { current_period_end: 1_800_000_000 }).current_period_end).toBe(new Date(1_800_000_000 * 1000).toISOString())
    }
    const life = decideStripeWebhook({
      id: "evt_life_period",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { payment_status: "paid", mode: "payment", client_reference_id: "user-2", customer: "cus_2" } },
    }, isolated)
    expect(life.action).toBe("apply")
    if (life.action === "apply") {
      expect(life.patch.stripe_subscription_id).toBeNull()
      expect(withCheckoutPeriodEnd(life.patch, { current_period_end: 1_800_000_000 })).toEqual(life.patch)
    }
  })

  it("un pago asíncrono exitoso también concede el plan", () => {
    const decision = decideStripeWebhook({
      id: "evt_async",
      type: "checkout.session.async_payment_succeeded",
      livemode: false,
      data: { object: { payment_status: "paid", mode: "subscription", metadata: { user_id: "user-9" }, subscription: "sub_9" } },
    }, isolated)
    expect(decision).toMatchObject({ action: "apply", userId: "user-9", patch: { plan: "pro" } })
  })
})

describe("firma de Stripe", () => {
  const secret = "whsec_prueba"
  const body = '{"id":"evt_1"}'
  const sign = (t: number, payload = body, s = secret) => `t=${t},v1=${createHmac("sha256", s).update(`${t}.${payload}`).digest("hex")}`
  it("acepta una firma correcta y reciente", () => {
    expect(verifyStripeSignature(body, sign(1000), secret, 1010)).toBe(true)
  })
  it("rechaza firma con otro secreto, cuerpo cambiado, antigua o ausente", () => {
    expect(verifyStripeSignature(body, sign(1000, body, "otro"), secret, 1010)).toBe(false)
    expect(verifyStripeSignature('{"id":"evt_2"}', sign(1000), secret, 1010)).toBe(false)
    expect(verifyStripeSignature(body, sign(1000), secret, 2000)).toBe(false)
    expect(verifyStripeSignature(body, null, secret, 1010)).toBe(false)
    expect(verifyStripeSignature(body, "t=1000", secret, 1010)).toBe(false)
  })
})
