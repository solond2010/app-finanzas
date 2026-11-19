import { describe, expect, it } from "vitest"
import {
  adminPlanKind,
  countsAsPaying,
  filterAdminUsers,
  paginateAdminUsers,
  sortAdminUsersBySignup,
  summarizeAdminUsers,
  type AdminUserRow,
} from "./admin-users"

describe("adminPlanKind", () => {
  it("trata la ausencia de plan como gratis", () => {
    expect(adminPlanKind(null)).toBe("free")
    expect(adminPlanKind({})).toBe("free")
  })

  it("distingue beta, 50 primeros, vitalicio y mensual", () => {
    expect(adminPlanKind({ plan: "pro", source: "early_access" })).toBe("early_access")
    expect(adminPlanKind({ plan: "pro", source: "first_fifty" })).toBe("first_fifty")
    expect(adminPlanKind({ plan: "founder", source: "stripe" })).toBe("lifetime")
    expect(adminPlanKind({ plan: "pro", source: "manual" })).toBe("lifetime")
    expect(adminPlanKind({ plan: "pro", source: "stripe", subscription_status: "active" })).toBe("monthly")
    expect(adminPlanKind({ plan: "pro", source: "stripe", subscription_status: "trialing" })).toBe("monthly")
    expect(adminPlanKind({ plan: "pro", source: "stripe", subscription_status: "past_due" })).toBe("monthly")
  })

  it("un mensual cancelado cuenta como gratis", () => {
    expect(adminPlanKind({ plan: "pro", source: "stripe", subscription_status: "canceled" })).toBe("free")
    expect(adminPlanKind({ plan: "free", source: "stripe", subscription_status: "canceled" })).toBe("free")
  })

  it("no deja que una fuente vitalicia se confunda con un mensual", () => {
    expect(adminPlanKind({ plan: "pro", source: "first_fifty", subscription_status: "active" })).toBe("first_fifty")
  })
})

describe("summarizeAdminUsers", () => {
  it("cuenta usuarios, Pro y solo los que han pagado por Stripe", () => {
    const totals = summarizeAdminUsers([
      { plan: "free" },
      { plan: "early_access", source: "early_access" },
      { plan: "first_fifty", source: "first_fifty" },
      { plan: "lifetime", source: "manual" },
      { plan: "lifetime", source: "stripe" },
      { plan: "monthly", source: "stripe" },
    ])
    expect(totals).toEqual({ users: 6, pro: 5, paying: 2 })
  })
})

describe("filterAdminUsers y paginación", () => {
  const users: AdminUserRow[] = [
    { email: "ana@example.com", created_at: "2026-01-02T00:00:00.000Z", plan: "monthly" },
    { email: "luis@example.com", created_at: "2026-02-01T00:00:00.000Z", plan: "free" },
    { email: "beta@example.com", created_at: "2026-03-01T00:00:00.000Z", plan: "early_access" },
  ]

  it("busca por email y por nombre de plan", () => {
    expect(filterAdminUsers(users, "ANA").map((u) => u.email)).toEqual(["ana@example.com"])
    expect(filterAdminUsers(users, "gratis").map((u) => u.email)).toEqual(["luis@example.com"])
    expect(filterAdminUsers(users, "  ").length).toBe(3)
  })

  it("ordena del más reciente al más antiguo", () => {
    expect(sortAdminUsersBySignup(users).map((u) => u.email)).toEqual([
      "beta@example.com",
      "luis@example.com",
      "ana@example.com",
    ])
  })

  it("pagina y corrige páginas fuera de rango", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      email: `u${i}@example.com`,
      created_at: "2026-01-01T00:00:00.000Z",
      plan: "free" as const,
    }))
    expect(paginateAdminUsers(many, 1).items).toHaveLength(25)
    expect(paginateAdminUsers(many, 2)).toMatchObject({ page: 2, pages: 2, total: 30 })
    expect(paginateAdminUsers(many, 2).items).toHaveLength(5)
    expect(paginateAdminUsers(many, 99).page).toBe(2)
    expect(paginateAdminUsers(many, 0).page).toBe(1)
  })
})
