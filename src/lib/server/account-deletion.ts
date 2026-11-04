import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

// Todas las tablas con datos de un usuario, de hijas a padres (claves ajenas).
export const USER_TABLES = [
  "asset_values",
  "debts",
  "assets",
  "investment_contributions",
  "investments",
  "watchlist",
  "transactions",
  "budgets",
  "sinking_funds",
  "wealth_goals",
  "accounts",
  "categories",
  "settings",
  "api_tokens",
  "feedback",
  "app_errors",
  "user_plans",
] as const

export const DELETE_CONFIRMATION = "BORRAR"

/** Borra todas las filas del usuario y después su usuario de Supabase Auth. Solo servidor, con la clave secreta. */
export async function deleteUserEverywhere(admin: SupabaseClient, userId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Usuario no válido")
  for (const table of USER_TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", userId)
    if (error) throw new Error(`No se pudo borrar ${table}: ${error.message}`)
  }
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(`No se pudo borrar el usuario: ${error.message}`)
}
