import "server-only"
import { supabaseServer } from "@/lib/supabase-server"
import {
  adminPlanKind,
  sortAdminUsersBySignup,
  summarizeAdminUsers,
  type AdminUserRow,
} from "@/lib/admin-users"

const AUTH_PAGE_SIZE = 1000
const MAX_AUTH_PAGES = 20

type PlanRow = { user_id: string; plan: string | null; source: string | null; subscription_status: string | null }

async function listAllAuthUsers() {
  const users: { id: string; email?: string; created_at?: string }[] = []
  for (let page = 1; page <= MAX_AUTH_PAGES; page++) {
    const { data, error } = await supabaseServer.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE })
    if (error) throw new Error(error.message)
    const batch = data.users ?? []
    users.push(...batch)
    if (batch.length < AUTH_PAGE_SIZE) break
  }
  return users
}

async function listAllPlans(): Promise<PlanRow[]> {
  const pageSize = 1000
  const rows: PlanRow[] = []
  for (let from = 0; from < 50_000; from += pageSize) {
    const { data, error } = await supabaseServer
      .from("user_plans")
      .select("user_id, plan, source, subscription_status")
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as PlanRow[]
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}

export async function listAdminUsers() {
  const [authUsers, plans] = await Promise.all([listAllAuthUsers(), listAllPlans()])
  const planByUser = new Map(plans.map((row) => [row.user_id, row]))
  const withSource = authUsers.map((user) => {
    const plan = planByUser.get(user.id)
    const kind = adminPlanKind(plan)
    return {
      email: user.email ?? null,
      created_at: user.created_at ?? "",
      plan: kind,
      source: plan?.source ?? null,
    }
  })
  const users: AdminUserRow[] = sortAdminUsersBySignup(
    withSource.map(({ email, created_at, plan }) => ({ email, created_at, plan })),
  )
  return { users, totals: summarizeAdminUsers(withSource) }
}
