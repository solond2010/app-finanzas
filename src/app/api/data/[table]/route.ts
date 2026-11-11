import { NextResponse } from "next/server"
import { selectAllRows } from "@/lib/supabase-server"
import { getDataContext, unauthorizedResponse } from "@/lib/server/request-context"
import { withUserId } from "@/lib/user-scope"
import { canHaveAccounts, FREE_MAX_ACCOUNTS, isPaid } from "@/lib/billing/plans"
import { getUserPlan, paymentsEnabled } from "@/lib/server/billing"
import { upsertIgnoringUnknownColumns } from "@/lib/upsert-unknown-columns"

// Únicas tablas a las que esta ruta puede dar acceso — evita que un valor de
// [table] arbitrario llegue a supabase.from(). El navegador ya no tiene la
// clave de Supabase (ver supabase-server.ts), así que esta ruta es el único
// punto por el que pasa cualquier lectura/escritura de estas tablas.
const ALLOWED_TABLES = new Set([
  "accounts",
  "transactions",
  "sinking_funds",
  "categories",
  "budgets",
  "watchlist",
  "investments",
  "investment_contributions",
  "wealth_goals",
  "assets",
  "asset_values",
  "debts",
])

function checkTable(table: string) {
  return ALLOWED_TABLES.has(table)
}

// Escrituras de inversiones, watchlist y metas: solo Pro cuando los pagos están activos.
// GET sigue abierto para la vista previa desenfocada. Nunca se borran filas.
const PRO_WRITE_TABLES = new Set(["investments", "watchlist", "investment_contributions", "wealth_goals"])

async function rejectFreeProWrite(table: string, userId: string) {
  if (!PRO_WRITE_TABLES.has(table) || !paymentsEnabled()) return null
  const plan = await getUserPlan(userId).catch(() => "pro" as const)
  if (isPaid(plan)) return null
  return NextResponse.json({ error: "Esto es de Garra Pro. Tus datos no se borran; pásate a Pro para usarlo.", code: "plan_limit" }, { status: 402 })
}

export async function GET(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  if (!checkTable(table)) return NextResponse.json({ error: "Tabla no permitida" }, { status: 400 })
  const ctx = await getDataContext()
  if (!ctx) return unauthorizedResponse()

  const fields = new URL(request.url).searchParams.get("fields") ?? "*"
  if (fields !== "*") return NextResponse.json({ error: "Solo se permite leer el conjunto completo de columnas" }, { status: 400 })
  try {
    const data = await selectAllRows(table, ctx)
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store, max-age=0" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron leer los datos" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  if (!checkTable(table)) return NextResponse.json({ error: "Tabla no permitida" }, { status: 400 })
  const ctx = await getDataContext()
  if (!ctx) return unauthorizedResponse()

  const denied = await rejectFreeProWrite(table, ctx.userId)
  if (denied) return denied

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "El cuerpo JSON no es válido" }, { status: 400 }) }
  const rows = body && typeof body === "object" ? (body as { rows?: unknown }).rows : undefined
  if (!Array.isArray(rows)) return NextResponse.json({ error: "rows debe ser un array" }, { status: 400 })
  if (rows.length === 0) return NextResponse.json({ ok: true })
  if (!rows.every((row) => !!row && typeof row === "object" && !Array.isArray(row))) return NextResponse.json({ error: "Cada fila debe ser un objeto" }, { status: 400 })

  // Plan gratis (solo con los pagos activados): máximo de cuentas.
  if (table === "accounts" && paymentsEnabled()) {
    const plan = await getUserPlan(ctx.userId).catch(() => "pro" as const)
    if (plan === "free") {
      const { data: existing } = await ctx.db.from("accounts").select("id").eq("user_id", ctx.userId)
      const ids = new Set((existing ?? []).map((r: { id: string }) => r.id))
      for (const row of rows as Record<string, unknown>[]) if (typeof row.id === "string") ids.add(row.id)
      if (!canHaveAccounts(plan, true, ids.size)) return NextResponse.json({ error: `El plan gratis permite hasta ${FREE_MAX_ACCOUNTS} cuentas. Pásate a Pro para tener más.`, code: "plan_limit" }, { status: 402 })
    }
  }

  // user_id lo pone SIEMPRE el servidor: el navegador no puede escribir a
  // nombre de otro usuario (y RLS lo rechazaría igualmente).
  // Si el cliente envía una columna que aún no existe en producción (p. ej.
  // interest_* antes de aplicar la migración), se reintenta sin esa columna
  // para no bloquear el resto del guardado (movimientos, etc.).
  const { error } = await upsertIgnoringUnknownColumns(
    (payload) => ctx.db.from(table).upsert(payload),
    withUserId(rows as Record<string, unknown>[], ctx.userId),
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  if (!checkTable(table)) return NextResponse.json({ error: "Tabla no permitida" }, { status: 400 })
  const ctx = await getDataContext()
  if (!ctx) return unauthorizedResponse()

  const denied = await rejectFreeProWrite(table, ctx.userId)
  if (denied) return denied

  let body: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ error: "El cuerpo JSON no es válido" }, { status: 400 })
    body = parsed as Record<string, unknown>
  } catch { return NextResponse.json({ error: "El cuerpo JSON no es válido" }, { status: 400 }) }
  if (Array.isArray(body.ids)) {
    if (body.ids.length === 0) return NextResponse.json({ ok: true })
    if (body.ids.length > 10_000 || !body.ids.every((id: unknown) => typeof id === "string" && id.length <= 200)) return NextResponse.json({ error: "Lista de identificadores no válida" }, { status: 400 })
    const { error } = await ctx.db.from(table).delete().eq("user_id", ctx.userId).in("id", body.ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  const allowedDeleteColumns = table === "watchlist" ? ["symbol"] : ["id"]
  if (typeof body.column === "string" && allowedDeleteColumns.includes(body.column) && typeof body.value === "string" && body.value.length <= 200) {
    const column: string = body.column
    const value: string = body.value
    const { error } = await ctx.db.from(table).delete().eq("user_id", ctx.userId).eq(column, value)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: "Falta ids o column/value" }, { status: 400 })
}
