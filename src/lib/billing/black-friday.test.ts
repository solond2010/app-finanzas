import { describe, expect, it } from "vitest"
import { decideStripeWebhook, mergePlanPatch } from "./webhook-plan"
import { PRICES_EUR } from "./plans"
import {
  BLACK_FRIDAY_COUPON_ID,
  BLACK_FRIDAY_END_UTC,
  BLACK_FRIDAY_NOTICE,
  BLACK_FRIDAY_OFF_EUR,
  BLACK_FRIDAY_REDEEM_BY_UNIX,
  BLACK_FRIDAY_START_UTC,
  blackFridayLifetimeOffer,
  checkoutCouponParams,
  isBlackFridayLifetimeActive,
  publicLifetimeOffer,
} from "./black-friday"

const isolated = { VERCEL_ENV: "preview", STRIPE_ALLOW_TEST_LEDGER: "true" }

const justBefore = new Date(Date.parse(BLACK_FRIDAY_START_UTC) - 1)
const atStart = new Date(BLACK_FRIDAY_START_UTC)
const midOffer = new Date("2026-11-28T12:00:00.000Z")
const lastInstant = new Date(Date.parse(BLACK_FRIDAY_END_UTC) - 1)
const justAfter = new Date(BLACK_FRIDAY_END_UTC)

describe("oferta Black Friday del vitalicio", () => {
  it("está inactiva justo antes y justo después de la ventana de Madrid", () => {
    expect(isBlackFridayLifetimeActive(justBefore)).toBe(false)
    expect(blackFridayLifetimeOffer(justBefore)).toBeNull()
    expect(publicLifetimeOffer(justBefore)).toBeNull()
    expect(checkoutCouponParams("pro_lifetime", justBefore)).toEqual({})
    expect(isBlackFridayLifetimeActive(justAfter)).toBe(false)
    expect(blackFridayLifetimeOffer(justAfter)).toBeNull()
    expect(checkoutCouponParams("pro_lifetime", justAfter)).toEqual({})
  })

  it("durante la ventana baja 5 € el vitalicio y aplica el cupón BLACKFRIDAY", () => {
    for (const when of [atStart, midOffer, lastInstant]) {
      expect(isBlackFridayLifetimeActive(when)).toBe(true)
      const offer = blackFridayLifetimeOffer(when)
      expect(offer).toMatchObject({
        couponId: BLACK_FRIDAY_COUPON_ID,
        listPriceEur: PRICES_EUR.pro_lifetime,
        salePriceEur: Number((PRICES_EUR.pro_lifetime - BLACK_FRIDAY_OFF_EUR).toFixed(2)),
        notice: BLACK_FRIDAY_NOTICE,
        redeemByUnix: BLACK_FRIDAY_REDEEM_BY_UNIX,
      })
      expect(offer?.salePriceEur).toBe(9.99)
      expect(publicLifetimeOffer(when)).toEqual({
        listPrice: PRICES_EUR.pro_lifetime,
        salePrice: 9.99,
        notice: BLACK_FRIDAY_NOTICE,
      })
      expect(checkoutCouponParams("pro_lifetime", when)).toEqual({ "discounts[0][coupon]": BLACK_FRIDAY_COUPON_ID })
      expect(checkoutCouponParams("pro_monthly", when)).toEqual({})
    }
    expect(BLACK_FRIDAY_REDEEM_BY_UNIX).toBe(1_796_079_600)
    expect(new Date(BLACK_FRIDAY_REDEEM_BY_UNIX * 1000).toISOString()).toBe(BLACK_FRIDAY_END_UTC)
  })

  it("el cupón no se mezcla con códigos de promoción en los parámetros de Checkout", () => {
    const params = checkoutCouponParams("pro_lifetime", midOffer)
    expect(params["allow_promotion_codes"]).toBeUndefined()
    expect(Object.keys(params)).toEqual(["discounts[0][coupon]"])
  })
})

describe("webhook con el importe rebajado", () => {
  it("concede el vitalicio igual si el pago único es de 9,99 € y no duplica derechos", () => {
    const paid = decideStripeWebhook({
      id: "evt_bf_life",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          payment_status: "paid",
          mode: "payment",
          amount_subtotal: 1499,
          amount_total: 999,
          currency: "eur",
          client_reference_id: "user-bf",
          customer: "cus_bf",
        },
      },
    }, isolated)
    expect(paid).toMatchObject({
      action: "apply",
      userId: "user-bf",
      patch: { plan: "founder", source: "stripe", subscription_status: "paid", stripe_subscription_id: null },
    })
    if (paid.action === "apply") {
      const again = mergePlanPatch({ plan: "founder", source: "stripe" }, paid.patch)
      expect(again.plan).toBeUndefined()
      expect(again.source).toBeUndefined()
    }
    const fullPrice = decideStripeWebhook({
      id: "evt_life_full",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { payment_status: "paid", mode: "payment", amount_total: 1499, client_reference_id: "user-bf-2", customer: "cus_bf2" } },
    }, isolated)
    expect(fullPrice).toMatchObject({ action: "apply", patch: { plan: "founder", source: "stripe" } })
  })
})
