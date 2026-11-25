import { describe, expect, it } from "vitest"
import { PRICES_EUR } from "./plans"
import { formatPriceEur } from "./pricing-page"
import {
  alreadyUsedMonthlyTrial,
  countsAsPriorSubscription,
  MONTHLY_TRIAL_DAYS,
  monthlyStatusFromCheckout,
  monthlySubscriptionCheckoutParams,
  monthlyTrialCheckoutMessage,
  monthlyTrialNote,
  shouldOfferMonthlyTrial,
} from "./monthly-trial"

describe("shouldOfferMonthlyTrial", () => {
  it("lo ofrece a quien empieza de cero, no a vitalicios ni a quien ya tuvo trial o suscripción", () => {
    expect(shouldOfferMonthlyTrial(null)).toBe(true)
    expect(shouldOfferMonthlyTrial({ plan: "free" })).toBe(true)
    expect(shouldOfferMonthlyTrial({ plan: "founder" })).toBe(false)
    expect(shouldOfferMonthlyTrial({ plan: "pro", source: "first_fifty" })).toBe(false)
    expect(shouldOfferMonthlyTrial({ plan: "pro", source: "admin_grant" })).toBe(false)
    expect(shouldOfferMonthlyTrial({ plan: "pro", source: "stripe", subscription_status: "active" })).toBe(false)
    expect(shouldOfferMonthlyTrial({ plan: "free", subscription_status: "trialing" })).toBe(false)
    expect(shouldOfferMonthlyTrial({ plan: "free", subscription_status: "canceled" })).toBe(false)
    expect(shouldOfferMonthlyTrial({ plan: "free", stripe_subscription_id: "sub_1" })).toBe(false)
    expect(shouldOfferMonthlyTrial({ plan: "free", hadPriorStripeSubscription: true })).toBe(false)
    expect(alreadyUsedMonthlyTrial({ subscription_status: "incomplete" })).toBe(false)
    expect(countsAsPriorSubscription("incomplete")).toBe(false)
    expect(countsAsPriorSubscription("canceled")).toBe(true)
  })
})

describe("parámetros de Checkout", () => {
  it("pide tarjeta siempre, y solo añade el trial de 30 días la primera vez", () => {
    expect(monthlySubscriptionCheckoutParams(false)).toEqual({ payment_method_collection: "always" })
    const withTrial = monthlySubscriptionCheckoutParams(true)
    expect(withTrial.payment_method_collection).toBe("always")
    expect(withTrial["subscription_data[trial_period_days]"]).toBe(String(MONTHLY_TRIAL_DAYS))
    expect(MONTHLY_TRIAL_DAYS).toBe(30)
    expect(withTrial["custom_text[submit][message]"]).toBe(monthlyTrialCheckoutMessage())
    expect(withTrial["custom_text[submit][message]"]).toContain("primer mes es gratis")
    expect(withTrial["custom_text[submit][message]"]).toContain(formatPriceEur(PRICES_EUR.pro_monthly))
    expect(withTrial["custom_text[submit][message]"]).toContain("2.º mes")
    expect(withTrial["custom_text[submit][message]"]).toContain("cancelar")
    expect(monthlyTrialNote()).toContain("Cancela cuando quieras")
  })
})

describe("monthlyStatusFromCheckout", () => {
  it("guarda trialing si no hay cobro o si Stripe trae ese estado, y active si ya pagó", () => {
    expect(monthlyStatusFromCheckout({ payment_status: "no_payment_required", subscription: "sub_1" })).toBe("trialing")
    expect(monthlyStatusFromCheckout({ payment_status: "paid", subscription: "sub_1" })).toBe("active")
    expect(monthlyStatusFromCheckout({ payment_status: "no_payment_required", subscription: { id: "sub_1", status: "trialing" } })).toBe("trialing")
    expect(monthlyStatusFromCheckout({ payment_status: "paid", subscription: { id: "sub_1", status: "active" } })).toBe("active")
  })
})
