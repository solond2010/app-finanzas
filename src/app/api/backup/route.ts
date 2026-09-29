import { NextResponse } from "next/server"
import { selectAllRows } from "@/lib/supabase-server"
import { timingSafeEqualString } from "@/lib/auth"

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
] as const

/** Read-only complete snapshot. The app-auth proxy protects this route. */
export async function GET(request: Request) {
  const secret = process.env.SHORTCUTS_SECRET
  const provided = request.headers.get("x-shortcuts-secret")
  if (!secret || !provided || !timingSafeEqualString(provided, secret)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  }
  try {
    const entries = await Promise.all(BACKUP_TABLES.map(async (table) => [table, await selectAllRows(table)] as const))

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
