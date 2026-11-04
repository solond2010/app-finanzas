import { NextResponse } from "next/server"
import { selectAllRows, supabaseServer } from "@/lib/supabase-server"
import { resolveShortcutUser } from "@/lib/server/shortcut-auth"

export const dynamic = "force-dynamic"

const BACKUP_TABLES = [
  "accounts",
  "transactions",
  "sinking_funds",
  "categories",
  "budgets",
  "watchlist",
  "investments",
  "investment_contributions",
  "settings",
  "wealth_goals",
] as const

/** Copia completa (solo lectura) de los datos DEL DUEÑO de la clave. */
export async function GET(request: Request) {
  const auth = await resolveShortcutUser(request)
  if (auth instanceof NextResponse) return auth
  const scope = { db: supabaseServer, userId: auth.userId }
  try {
    const entries = await Promise.all(BACKUP_TABLES.map(async (table) => [table, await selectAllRows(table, scope)] as const))

    const tables = Object.fromEntries(entries)
    return NextResponse.json({
      app: "app-finanzas",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      tables,
    }, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="app-finanzas-backup_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (error) {
    console.error("[Finance] No se pudo crear la copia de seguridad:", error)
    return NextResponse.json({ error: "No se pudo leer el conjunto completo de datos; no se ha generado ninguna copia parcial." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    })
  }
}
