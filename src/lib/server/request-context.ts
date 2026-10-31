import "server-only"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { supabaseServer, type DbScope } from "@/lib/supabase-server"
import { isSupabaseAuthEnabled, LEGACY_USER_ID } from "@/lib/auth-mode"

// Contexto de datos de cada petición: qué cliente de base de datos usar y de
// qué usuario son los datos.
//  - Modo cuentas (AUTH_MODE=supabase): cliente con la sesión del usuario y la
//    clave pública → Postgres aplica RLS (user_id = auth.uid()). Aunque una
//    ruta olvidara un filtro, la base de datos no devolvería filas ajenas.
//  - Modo antiguo: el cliente de servidor de siempre y el dueño histórico.
// En ambos casos las rutas filtran además por user_id (doble barrera).

export type DataContext = DbScope & { email: string | null }

export async function createSupabaseRouteClient() {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error("Falta SUPABASE_URL o SUPABASE_ANON_KEY")
  const cookieStore = await cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Desde un Server Component no se pueden escribir cookies; proxy.ts
          // ya refresca la sesión en cada petición.
        }
      },
    },
  })
}

export async function getDataContext(): Promise<DataContext | null> {
  if (!isSupabaseAuthEnabled()) return { db: supabaseServer, userId: LEGACY_USER_ID, email: null }
  const supabase = await createSupabaseRouteClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return { db: supabase, userId: data.user.id, email: data.user.email ?? null }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "No has iniciado sesión" }, { status: 401, headers: { "Cache-Control": "no-store" } })
}
