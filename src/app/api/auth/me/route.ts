import { isAdminUserId, isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { getDataContext, unauthorizedResponse } from "@/lib/server/request-context"
import { json } from "@/lib/server/auth-helpers"

export async function GET() {
  const ctx = await getDataContext()
  if (!ctx) return unauthorizedResponse()
  return json({ mode: isSupabaseAuthEnabled() ? "accounts" : "password", userId: ctx.userId, email: ctx.email, name: ctx.name, isAdmin: isAdminUserId(ctx.userId) })
}
