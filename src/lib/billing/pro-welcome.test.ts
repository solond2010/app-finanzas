import { describe, expect, it } from "vitest"
import { mergePlanPatch } from "./webhook-plan"
import {
  buildPaidProWelcomeEmail,
  missingProWelcomeEnv,
  paidStripeProKind,
  proWelcomeEmailConfigured,
  proWelcomeIdempotencyKey,
  resultingPlanAfterPatch,
  shouldClaimPaidProWelcome,
} from "./pro-welcome"

describe("proWelcomeEmailConfigured", () => {
  it("exige solo RESEND_API_KEY y no falla si falta", () => {
    expect(proWelcomeEmailConfigured({})).toBe(false)
    expect(missingProWelcomeEnv({})).toEqual(["RESEND_API_KEY"])
    expect(proWelcomeEmailConfigured({ RESEND_API_KEY: "re_test" })).toBe(true)
    expect(missingProWelcomeEnv({ RESEND_API_KEY: "re_test" })).toEqual([])
  })
})

describe("shouldClaimPaidProWelcome", () => {
  it("reclama el primer Pro mensual o vitalicio de pago", () => {
    expect(shouldClaimPaidProWelcome({
      existing: { plan: "free", source: "stripe" },
      merged: { plan: "pro", source: "stripe", subscription_status: "active" },
      alreadyClaimed: false,
    })).toBe("monthly")
    expect(shouldClaimPaidProWelcome({
      existing: null,
      merged: { plan: "founder", source: "stripe", subscription_status: "paid" },
      alreadyClaimed: false,
    })).toBe("lifetime")
  })

  it("no reclama renovaciones, cancelaciones ni un Pro que ya era de pago", () => {
    const alreadyMonthly = { plan: "pro", source: "stripe", subscription_status: "active" }
    expect(shouldClaimPaidProWelcome({
      existing: alreadyMonthly,
      merged: { ...alreadyMonthly, cancel_at_period_end: true } as typeof alreadyMonthly,
      alreadyClaimed: false,
    })).toBeNull()
    expect(shouldClaimPaidProWelcome({
      existing: alreadyMonthly,
      merged: { plan: "founder", source: "stripe", subscription_status: "paid" },
      alreadyClaimed: false,
    })).toBeNull()
    expect(shouldClaimPaidProWelcome({
      existing: { plan: "free", source: "stripe" },
      merged: { plan: "pro", source: "stripe", subscription_status: "canceled" },
      alreadyClaimed: false,
    })).toBeNull()
  })

  it("no reclama Pro regalado, de los 50 primeros ni de la beta, y no lo hace dos veces", () => {
    expect(shouldClaimPaidProWelcome({
      existing: { plan: "pro", source: "first_fifty" },
      merged: mergePlanPatch({ plan: "pro", source: "first_fifty" }, { plan: "pro", source: "stripe", subscription_status: "active" }),
      alreadyClaimed: false,
    })).toBeNull()
    expect(paidStripeProKind({ plan: "pro", source: "admin_grant" })).toBeNull()
    expect(paidStripeProKind({ plan: "pro", source: "early_access" })).toBeNull()
    expect(shouldClaimPaidProWelcome({
      existing: { plan: "free", source: "stripe" },
      merged: { plan: "pro", source: "stripe", subscription_status: "active" },
      alreadyClaimed: true,
    })).toBeNull()
  })

  it("un parche sobre un vitalicio previo no se interpreta como activación de pago", () => {
    const existing = { plan: "pro" as const, source: "first_fifty" }
    const patch = { plan: "pro" as const, source: "stripe", subscription_status: "active" }
    const merged = resultingPlanAfterPatch(existing, mergePlanPatch(existing, patch))
    expect(shouldClaimPaidProWelcome({ existing, merged, alreadyClaimed: false })).toBeNull()
  })
})

describe("buildPaidProWelcomeEmail", () => {
  it("es breve, en español, con enlace a la app y sin nombres propios", () => {
    const monthly = buildPaidProWelcomeEmail("monthly")
    const lifetime = buildPaidProWelcomeEmail("lifetime")
    expect(monthly.subject).toMatch(/Garra Pro/)
    expect(monthly.text).toMatch(/Gracias/)
    expect(monthly.text).toMatch(/www\.migarra\.app/)
    expect(monthly.text).toMatch(/Ajustes/)
    expect(monthly.text).not.toMatch(/Moha|Mohamed/i)
    expect(lifetime.text).toMatch(/por vida/)
    expect(lifetime.text).not.toMatch(/Ajustes/)
    expect(lifetime.html).toContain("www.migarra.app")
    expect(proWelcomeIdempotencyKey("user-1")).toBe("garra-pro-welcome:user-1")
  })
})
