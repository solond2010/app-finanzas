import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { canHaveAccounts, entitlementsFor, subscriptionGivesPro } from "./plans"
import { verifyStripeSignature } from "./stripe-signature"

describe("planes", () => {
  it("con los pagos apagados nadie tiene límites", () => {
    expect(entitlementsFor("free", false).maxAccounts).toBeNull()
    expect(canHaveAccounts("free", false, 50)).toBe(true)
  })
  it("con los pagos activos el plan gratis tiene 3 cuentas y Pro/Fundador ilimitadas", () => {
    expect(canHaveAccounts("free", true, 3)).toBe(true)
    expect(canHaveAccounts("free", true, 4)).toBe(false)
    expect(entitlementsFor("free", true).investments).toBe(false)
    expect(canHaveAccounts("pro", true, 40)).toBe(true)
    expect(entitlementsFor("founder", true).export).toBe(true)
  })
  it("estados de suscripción que dan Pro", () => {
    expect(subscriptionGivesPro("active")).toBe(true)
    expect(subscriptionGivesPro("canceled")).toBe(false)
    expect(subscriptionGivesPro(null)).toBe(false)
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
