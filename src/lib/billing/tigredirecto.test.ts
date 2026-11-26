import { describe, expect, it } from "vitest"
import { BLACK_FRIDAY_COUPON_ID, BLACK_FRIDAY_END_UTC, BLACK_FRIDAY_START_UTC } from "./black-friday"
import {
  checkoutPromoCouponParams,
  normalizePromoCode,
  parseLifetimePromoCode,
  TIGRE_DIRECTO_COUPON_ID,
  TIGRE_DIRECTO_INVALID,
  TIGRE_DIRECTO_MONTHLY,
} from "./tigredirecto"

const beforeBf = new Date(Date.parse(BLACK_FRIDAY_START_UTC) - 1)
const duringBf = new Date(Date.parse(BLACK_FRIDAY_START_UTC) + 60_000)
const afterBf = new Date(Date.parse(BLACK_FRIDAY_END_UTC))

describe("código TIGREDIRECTO", () => {
  it("normaliza mayúsculas y espacios y acepta solo TIGREDIRECTO", () => {
    expect(normalizePromoCode("  tigre directo  ")).toBe("TIGREDIRECTO")
    expect(normalizePromoCode("TigreDirecto")).toBe("TIGREDIRECTO")
    expect(parseLifetimePromoCode("")).toEqual({ ok: true, empty: true })
    expect(parseLifetimePromoCode("   ")).toEqual({ ok: true, empty: true })
    expect(parseLifetimePromoCode("tigre directo")).toEqual({ ok: true, couponId: TIGRE_DIRECTO_COUPON_ID })
    expect(parseLifetimePromoCode("TIGRE4DIC")).toEqual({ ok: false, error: TIGRE_DIRECTO_INVALID })
  })

  it("fuera del Black Friday aplica el cupón solo al vitalicio", () => {
    const applied = checkoutPromoCouponParams("pro_lifetime", "TIGREDIRECTO", beforeBf)
    expect(applied).toEqual({
      ok: true,
      params: { "discounts[0][coupon]": TIGRE_DIRECTO_COUPON_ID },
      couponId: TIGRE_DIRECTO_COUPON_ID,
    })
    expect(checkoutPromoCouponParams("pro_lifetime", "", beforeBf)).toEqual({ ok: true, params: {}, couponId: null })
    expect(checkoutPromoCouponParams("pro_lifetime", "no-vale", beforeBf)).toEqual({ ok: false, error: TIGRE_DIRECTO_INVALID })
    expect(checkoutPromoCouponParams("pro_monthly", "TIGREDIRECTO", beforeBf)).toEqual({ ok: false, error: TIGRE_DIRECTO_MONTHLY })
    expect(checkoutPromoCouponParams("pro_monthly", "", beforeBf)).toEqual({ ok: true, params: {}, couponId: null })
    expect(checkoutPromoCouponParams("pro_lifetime", "tigredirecto", afterBf).ok).toBe(true)
  })

  it("durante el Black Friday no acumula descuentos ni usa allow_promotion_codes", () => {
    const withCode = checkoutPromoCouponParams("pro_lifetime", " tigre directo ", duringBf)
    const without = checkoutPromoCouponParams("pro_lifetime", "", duringBf)
    expect(withCode).toEqual(without)
    expect(withCode).toEqual({
      ok: true,
      params: { "discounts[0][coupon]": BLACK_FRIDAY_COUPON_ID },
      couponId: BLACK_FRIDAY_COUPON_ID,
    })
    if (withCode.ok) expect(withCode.params["allow_promotion_codes"]).toBeUndefined()
    expect(Object.keys(withCode.ok ? withCode.params : {})).toEqual(["discounts[0][coupon]"])
    expect(checkoutPromoCouponParams("pro_lifetime", "OTRO", duringBf)).toEqual({ ok: false, error: TIGRE_DIRECTO_INVALID })
    expect(checkoutPromoCouponParams("pro_monthly", "TIGREDIRECTO", duringBf)).toEqual({ ok: false, error: TIGRE_DIRECTO_MONTHLY })
  })
})
