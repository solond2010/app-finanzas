import { getDataContext } from "@/lib/server/request-context"
import { json } from "@/lib/server/auth-helpers"
import { isAdminUserId } from "@/lib/auth-mode"

// Contador para el menú «Administración»: comentarios aún sin revisar
// (estado «nuevo»). Misma regla que /api/admin: a cualquier otro, 404.
export async function GET() {
  const ctx = await getDataContext()
  if (!ctx || !isAdminUserId(ctx.userId)) return json({ error: "No encontrado" }, 404)
  const { count, error } = await ctx.db.from("feedback").select("id", { count: "exact", head: true }).eq("status", "nuevo")
  if (error) return json({ nuevos: 0 })
  return json({ nuevos: count ?? 0 })
}
