// Clasificación de planes para el listado de usuarios de Administración.
// Solo se usa en el servidor y en tests; no expone ids de Stripe ni secretos.

import { asPlan, isPaid, isLifetimeAccess, subscriptionGivesPro } from "@/lib/billing/plans"

export type AdminPlanKind = "free" | "monthly" | "lifetime" | "first_fifty" | "early_access"

export type AdminPlanInput = {
  plan?: string | null
  source?: string | null
  subscription_status?: string | null
}

export type AdminUserRow = {
  email: string | null
  created_at: string
  plan: AdminPlanKind
}

export const ADMIN_PLAN_LABELS: Record<AdminPlanKind, string> = {
  free: "Gratis",
  monthly: "Pro mensual",
  lifetime: "Pro de por vida",
  first_fifty: "50 primeros",
  early_access: "Beta",
}

export const ADMIN_USERS_PAGE_SIZE = 25

/** Qué etiqueta mostrar: primero las fuentes vitalicias, luego el plan de pago. */
export function adminPlanKind(input: AdminPlanInput | null | undefined): AdminPlanKind {
  if (!input) return "free"
  const source = input.source ?? ""
  const plan = asPlan(input.plan)
  if (source === "early_access") return "early_access"
  if (source === "first_fifty") return "first_fifty"
  if (plan === "founder" || source === "manual") return "lifetime"
  if (plan === "pro") {
    if (source === "stripe" && !subscriptionGivesPro(input.subscription_status)) return "free"
    return "monthly"
  }
  if (isPaid(plan) || isLifetimeAccess(plan, source)) return "lifetime"
  return "free"
}

/** De pago = lo que ha pasado por Stripe (mensual o único), no beta ni 50 primeros ni manual. */
export function countsAsPaying(kind: AdminPlanKind, source?: string | null): boolean {
  if (kind === "monthly") return true
  return kind === "lifetime" && source === "stripe"
}

export function summarizeAdminUsers(users: { plan: AdminPlanKind; source?: string | null }[]) {
  return {
    users: users.length,
    pro: users.filter((user) => user.plan !== "free").length,
    paying: users.filter((user) => countsAsPaying(user.plan, user.source)).length,
  }
}

export function filterAdminUsers(users: AdminUserRow[], query: string): AdminUserRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return users
  return users.filter((user) => {
    const email = (user.email ?? "").toLowerCase()
    const label = ADMIN_PLAN_LABELS[user.plan].toLowerCase()
    return email.includes(q) || label.includes(q) || user.plan.includes(q)
  })
}

export function paginateAdminUsers(users: AdminUserRow[], page: number, pageSize = ADMIN_USERS_PAGE_SIZE) {
  const total = users.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), pages)
  const start = (safePage - 1) * pageSize
  return { items: users.slice(start, start + pageSize), page: safePage, pages, total }
}

export function sortAdminUsersBySignup(users: AdminUserRow[]): AdminUserRow[] {
  return [...users].sort((a, b) => {
    if (a.created_at > b.created_at) return -1
    if (a.created_at < b.created_at) return 1
    return (a.email ?? "").localeCompare(b.email ?? "", "es")
  })
}
