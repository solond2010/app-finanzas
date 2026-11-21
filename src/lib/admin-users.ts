// Clasificación de planes para el listado de usuarios de Administración.
// Solo se usa en el servidor y en tests; no expone ids de Stripe ni secretos.

import { asPlan, isPaid, isLifetimeAccess, subscriptionGivesPro, type Plan } from "@/lib/billing/plans"

export type AdminPlanKind = "free" | "monthly" | "lifetime" | "first_fifty" | "early_access"

export type AdminPlanInput = {
  plan?: string | null
  source?: string | null
  subscription_status?: string | null
}

export type AdminUserRow = {
  id: string
  email: string | null
  created_at: string
  plan: AdminPlanKind
  canGrant: boolean
  canRevoke: boolean
}

export type AdminProAction = "grant" | "revoke"

export const ADMIN_PLAN_LABELS: Record<AdminPlanKind, string> = {
  free: "Gratis",
  monthly: "Pro mensual",
  lifetime: "Pro de por vida",
  first_fifty: "50 primeros",
  early_access: "Beta",
}

export const ADMIN_USERS_PAGE_SIZE = 25

const USER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUserUuid(value: string): boolean {
  return USER_ID_RE.test(value)
}

/** Qué etiqueta mostrar: primero las fuentes vitalicias, luego el plan de pago. */
export function adminPlanKind(input: AdminPlanInput | null | undefined): AdminPlanKind {
  if (!input) return "free"
  const source = input.source ?? ""
  const plan = asPlan(input.plan)
  if (source === "early_access") return "early_access"
  if (source === "first_fifty") return "first_fifty"
  if (plan === "founder" || source === "manual" || source === "admin_grant") return "lifetime"
  if (plan === "pro") {
    if (source === "stripe" && !subscriptionGivesPro(input.subscription_status)) return "free"
    return "monthly"
  }
  if (isPaid(plan) || isLifetimeAccess(plan, source)) return "lifetime"
  return "free"
}

/** El botón de quitar solo aplica al Pro otorgado desde Administración. */
export function adminProCapabilities(input: AdminPlanInput | null | undefined): { canGrant: boolean; canRevoke: boolean } {
  if ((input?.source ?? "") === "admin_grant") return { canGrant: false, canRevoke: true }
  if (adminPlanKind(input) === "free") return { canGrant: true, canRevoke: false }
  return { canGrant: false, canRevoke: false }
}

function adminProChangeError(input: AdminPlanInput | null | undefined, action: AdminProAction): string {
  if (action === "revoke") return "Solo se puede quitar el Pro otorgado desde Administración."
  const kind = adminPlanKind(input)
  if ((input?.source ?? "") === "admin_grant") return "Este usuario ya tiene el Pro otorgado desde Administración."
  if (kind === "first_fifty") return "Este usuario es de los 50 primeros. Ese Pro no se puede cambiar desde aquí."
  if (kind === "early_access") return "Este usuario tiene Pro de la beta. No se puede cambiar desde aquí."
  if (kind === "monthly" || (kind === "lifetime" && (input?.source ?? "") === "stripe")) {
    return "Este usuario tiene un Pro de pago. No se toca desde aquí."
  }
  if (kind === "lifetime") return "Este usuario ya tiene Pro de por vida. No se puede cambiar desde aquí."
  return "No se puede otorgar Pro a este usuario."
}

/**
 * Decide el cambio de plan desde Administración. No toca Stripe, los 50
 * primeros, la beta ni un Pro de pago; quitar solo revoca admin_grant.
 */
export function decideAdminProChange(
  input: AdminPlanInput | null | undefined,
  action: AdminProAction,
): { ok: true; plan: Plan; source: string } | { ok: false; error: string } {
  const caps = adminProCapabilities(input)
  if (action === "grant") {
    if (!caps.canGrant) return { ok: false, error: adminProChangeError(input, action) }
    return { ok: true, plan: "pro", source: "admin_grant" }
  }
  if (!caps.canRevoke) return { ok: false, error: adminProChangeError(input, action) }
  return { ok: true, plan: "free", source: "stripe" }
}

/** De pago = lo que ha pasado por Stripe (mensual o único), no beta ni 50 primeros ni manual. */
export function countsAsPaying(kind: AdminPlanKind, source?: string | null): boolean {
  if (kind === "monthly") return true
  return kind === "lifetime" && source === "stripe"
}

export type AdminUserTotals = {
  users: number
  pro: number
  paying: number
  monthlyPaid: number
  lifetimePaid: number
  firstFifty: number
  adminGrant: number
  free: number
  signedUpLast7Days: number
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/** Cifras del panel de usuarios. `now` se inyecta en tests. */
export function summarizeAdminUsers(
  users: { plan: AdminPlanKind; source?: string | null; created_at?: string }[],
  now: Date = new Date(),
): AdminUserTotals {
  const since = now.getTime() - SEVEN_DAYS_MS
  return {
    users: users.length,
    pro: users.filter((user) => user.plan !== "free").length,
    paying: users.filter((user) => countsAsPaying(user.plan, user.source)).length,
    monthlyPaid: users.filter((user) => user.plan === "monthly").length,
    lifetimePaid: users.filter((user) => user.plan === "lifetime" && user.source === "stripe").length,
    firstFifty: users.filter((user) => user.plan === "first_fifty").length,
    adminGrant: users.filter((user) => user.source === "admin_grant").length,
    free: users.filter((user) => user.plan === "free").length,
    signedUpLast7Days: users.filter((user) => {
      const t = user.created_at ? Date.parse(user.created_at) : NaN
      return Number.isFinite(t) && t >= since && t <= now.getTime()
    }).length,
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
