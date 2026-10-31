import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Cliente de Supabase para uso EXCLUSIVO en rutas API (servidor). La URL y la
// clave ya no llevan el prefijo NEXT_PUBLIC_, así que Next.js no las incluye
// en el bundle que se manda al navegador: antes cualquiera podía sacar estas
// credenciales inspeccionando la web desplegada y hablar con Supabase
// directamente, saltándose por completo la contraseña de la app (RLS está
// desactivado en todas las tablas). Ahora el navegador solo habla con
// nuestras propias rutas /api/data y /api/storage, protegidas por la misma
// cookie de sesión que ya usa el middleware.
//
// Clave: se usa SUPABASE_SERVICE_ROLE_KEY (clave secreta, solo servidor) si
// existe; si no, se recurre a SUPABASE_ANON_KEY. Con RLS activado y sin
// políticas para "anon", solo la clave secreta puede leer/escribir, así que
// la clave pública deja de dar acceso directo a la base de datos.
// NUNCA importes este archivo desde un componente de cliente ni uses el
// prefijo NEXT_PUBLIC_ con estas variables ("server-only" lo impide).
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServerKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!

// Cliente "administrador" (clave secreta, se salta RLS). Úsalo SOLO donde no
// hay sesión de navegador (Atajos con clave, copia de seguridad) y SIEMPRE
// con filtro explícito por user_id. Las rutas con sesión usan el cliente del
// usuario (ver server/request-context.ts), que respeta RLS.
export const supabaseServer = createClient(supabaseUrl, supabaseServerKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export type DbScope = { db: SupabaseClient; userId: string }

const PRIMARY_KEYS: Record<string, string> = {
  accounts: "id",
  transactions: "id",
  sinking_funds: "id",
  categories: "id",
  budgets: "id",
  watchlist: "symbol",
  investments: "id",
  investment_contributions: "id",
  settings: "key",
}

/** Read complete tables in stable, bounded pages instead of silently stopping at PostgREST's row limit. */
export async function selectAllRows(table: string, scope: DbScope, fields = "*") {
  const primaryKey = PRIMARY_KEYS[table]
  if (!primaryKey) throw new Error(`Tabla de lectura desconocida: ${table}`)
  const pageSize = 500
  const maxRows = 250_000
  const rows: Record<string, unknown>[] = []

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data, error } = await scope.db
      .from(table)
      .select(fields)
      .eq("user_id", scope.userId)
      .order(primaryKey, { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(`No se pudo leer ${table}: ${error.message}`)
    const page = (data ?? []) as unknown as Record<string, unknown>[]
    rows.push(...page)
    if (page.length < pageSize) return rows
  }

  throw new Error(`La tabla ${table} supera el límite de seguridad de ${maxRows} filas`)
}
