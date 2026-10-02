import { NextResponse } from "next/server"
import { supabaseServer, selectAllRows } from "@/lib/supabase-server"

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
])

function checkTable(table: string) {
  return ALLOWED_TABLES.has(table)
}

export async function GET(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  if (!checkTable(table)) return NextResponse.json({ error: "Tabla no permitida" }, { status: 400 })

  const fields = new URL(request.url).searchParams.get("fields") ?? "*"
  if (fields !== "*") return NextResponse.json({ error: "Solo se permite leer el conjunto completo de columnas" }, { status: 400 })
  try {
    const data = await selectAllRows(table)
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store, max-age=0" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron leer los datos" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  if (!checkTable(table)) return NextResponse.json({ error: "Tabla no permitida" }, { status: 400 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "El cuerpo JSON no es válido" }, { status: 400 }) }
  const rows = body && typeof body === "object" ? (body as { rows?: unknown }).rows : undefined
  if (!Array.isArray(rows)) return NextResponse.json({ error: "rows debe ser un array" }, { status: 400 })
  if (rows.length === 0) return NextResponse.json({ ok: true })
  if (!rows.every((row) => !!row && typeof row === "object" && !Array.isArray(row))) return NextResponse.json({ error: "Cada fila debe ser un objeto" }, { status: 400 })

  const { error } = await supabaseServer.from(table).upsert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  if (!checkTable(table)) return NextResponse.json({ error: "Tabla no permitida" }, { status: 400 })

  let body: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ error: "El cuerpo JSON no es válido" }, { status: 400 })
    body = parsed as Record<string, unknown>
  } catch { return NextResponse.json({ error: "El cuerpo JSON no es válido" }, { status: 400 }) }
  if (Array.isArray(body.ids)) {
    if (body.ids.length === 0) return NextResponse.json({ ok: true })
    if (body.ids.length > 10_000 || !body.ids.every((id: unknown) => typeof id === "string" && id.length <= 200)) return NextResponse.json({ error: "Lista de identificadores no válida" }, { status: 400 })
    const { error } = await supabaseServer.from(table).delete().in("id", body.ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  const allowedDeleteColumns = table === "watchlist" ? ["symbol"] : ["id"]
  if (typeof body.column === "string" && allowedDeleteColumns.includes(body.column) && typeof body.value === "string" && body.value.length <= 200) {
    const column: string = body.column
    const value: string = body.value
    const { error } = await supabaseServer.from(table).delete().eq(column, value)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: "Falta ids o column/value" }, { status: 400 })
}
