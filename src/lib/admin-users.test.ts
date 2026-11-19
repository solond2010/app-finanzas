import { describe, expect, it } from "vitest"
import {
  adminPlanKind,
  adminProCapabilities,
  countsAsPaying,
  decideAdminProChange,
  filterAdminUsers,
  isUserUuid,
  paginateAdminUsers,
  sortAdminUsersBySignup,
  summarizeAdminUsers,
  type AdminUserRow,
} from "./admin-users"

const user = (row: Partial<AdminUserRow> & Pick<AdminUserRow, "email" | "created_at" | "plan">): AdminUserRow => ({
  id: row.id ?? "00000000-0000-0000-0000-000000000001",
  canGrant: row.canGrant ?? row.plan === "free",
  canRevoke: row.canRevoke ?? false,
  ...row,
})

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
    expect(adminPlanKind({ plan: "pro", source: "admin_grant" })).toBe("lifetime")
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
    expect(adminPlanKind({ plan: "pro", source: "admin_grant", subscription_status: "canceled" })).toBe("lifetime")
  })
})

describe("decideAdminProChange", () => {
  it("concede Pro de por vida a quien está en gratis, también si canceló un mensual", () => {
    expect(decideAdminProChange(null, "grant")).toEqual({ ok: true, plan: "pro", source: "admin_grant" })
    expect(decideAdminProChange({ plan: "free" }, "grant")).toEqual({ ok: true, plan: "pro", source: "admin_grant" })
    expect(decideAdminProChange({ plan: "pro", source: "stripe", subscription_status: "canceled" }, "grant")).toEqual({
      ok: true,
      plan: "pro",
      source: "admin_grant",
    })
  })

  it("no toca un Pro de pago, de los 50 primeros, de la beta ni uno ya vitalicio", () => {
    expect(decideAdminProChange({ plan: "pro", source: "stripe", subscription_status: "active" }, "grant").ok).toBe(false)
    expect(decideAdminProChange({ plan: "founder", source: "stripe" }, "grant").ok).toBe(false)
    expect(decideAdminProChange({ plan: "pro", source: "first_fifty" }, "grant").ok).toBe(false)
    expect(decideAdminProChange({ plan: "pro", source: "early_access" }, "grant").ok).toBe(false)
    expect(decideAdminProChange({ plan: "pro", source: "manual" }, "grant").ok).toBe(false)
    expect(decideAdminProChange({ plan: "pro", source: "admin_grant" }, "grant").ok).toBe(false)
    const paid = decideAdminProChange({ plan: "pro", source: "stripe", subscription_status: "active" }, "grant")
    if (!paid.ok) expect(paid.error).toMatch(/pago/)
    const first = decideAdminProChange({ plan: "pro", source: "first_fifty" }, "grant")
    if (!first.ok) expect(first.error).toMatch(/50 primeros/)
  })

  it("quitar solo revoca el Pro otorgado desde Administración", () => {
    expect(decideAdminProChange({ plan: "pro", source: "admin_grant" }, "revoke")).toEqual({
      ok: true,
      plan: "free",
      source: "stripe",
    })
    expect(decideAdminProChange({ plan: "pro", source: "first_fifty" }, "revoke").ok).toBe(false)
    expect(decideAdminProChange({ plan: "pro", source: "early_access" }, "revoke").ok).toBe(false)
    expect(decideAdminProChange({ plan: "founder", source: "stripe" }, "revoke").ok).toBe(false)
    expect(decideAdminProChange({ plan: "pro", source: "stripe", subscription_status: "active" }, "revoke").ok).toBe(false)
    expect(decideAdminProChange({ plan: "pro", source: "manual" }, "revoke").ok).toBe(false)
    expect(decideAdminProChange({ plan: "free" }, "revoke").ok).toBe(false)
    const blocked = decideAdminProChange({ plan: "pro", source: "first_fifty" }, "revoke")
    if (!blocked.ok) expect(blocked.error).toMatch(/Administración/)
  })

  it("los botones coinciden con lo que el servidor permite", () => {
    expect(adminProCapabilities(null)).toEqual({ canGrant: true, canRevoke: false })
    expect(adminProCapabilities({ plan: "pro", source: "admin_grant" })).toEqual({ canGrant: false, canRevoke: true })
    expect(adminProCapabilities({ plan: "pro", source: "first_fifty" })).toEqual({ canGrant: false, canRevoke: false })
    expect(adminProCapabilities({ plan: "pro", source: "stripe", subscription_status: "active" })).toEqual({
      canGrant: false,
      canRevoke: false,
    })
  })

  it("acepta un id de usuario en formato uuid y rechaza el resto", () => {
    expect(isUserUuid("2f1a0c8e-4b3d-4a11-9c2f-7e6d5b4a3210")).toBe(true)
    expect(isUserUuid("no-es-un-uuid")).toBe(false)
    expect(isUserUuid("")).toBe(false)
  })
})

describe("summarizeAdminUsers", () => {
  it("cuenta usuarios, Pro y solo los que han pagado por Stripe", () => {
    const totals = summarizeAdminUsers([
      { plan: "free" },
      { plan: "early_access", source: "early_access" },
      { plan: "first_fifty", source: "first_fifty" },
      { plan: "lifetime", source: "manual" },
      { plan: "lifetime", source: "admin_grant" },
      { plan: "lifetime", source: "stripe" },
      { plan: "monthly", source: "stripe" },
    ])
    expect(totals).toEqual({ users: 7, pro: 6, paying: 2 })
  })
})

describe("filterAdminUsers y paginación", () => {
  const users: AdminUserRow[] = [
    user({ email: "ana@example.com", created_at: "2026-01-02T00:00:00.000Z", plan: "monthly" }),
    user({ email: "luis@example.com", created_at: "2026-02-01T00:00:00.000Z", plan: "free" }),
    user({ email: "beta@example.com", created_at: "2026-03-01T00:00:00.000Z", plan: "early_access" }),
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
    const many = Array.from({ length: 30 }, (_, i) => user({
      id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      email: `u${i}@example.com`,
      created_at: "2026-01-01T00:00:00.000Z",
      plan: "free",
    }))
    expect(paginateAdminUsers(many, 1).items).toHaveLength(25)
    expect(paginateAdminUsers(many, 2)).toMatchObject({ page: 2, pages: 2, total: 30 })
    expect(paginateAdminUsers(many, 2).items).toHaveLength(5)
    expect(paginateAdminUsers(many, 99).page).toBe(2)
    expect(paginateAdminUsers(many, 0).page).toBe(1)
  })
})
