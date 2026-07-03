import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

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
  const { data, error } = await supabaseServer.from(table).select(fields)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  if (!checkTable(table)) return NextResponse.json({ error: "Tabla no permitida" }, { status: 400 })

  const { rows } = await request.json()
  if (!Array.isArray(rows)) return NextResponse.json({ error: "rows debe ser un array" }, { status: 400 })
  if (rows.length === 0) return NextResponse.json({ ok: true })

  const { error } = await supabaseServer.from(table).upsert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  if (!checkTable(table)) return NextResponse.json({ error: "Tabla no permitida" }, { status: 400 })

  const body = await request.json()
  if (Array.isArray(body.ids)) {
    if (body.ids.length === 0) return NextResponse.json({ ok: true })
    const { error } = await supabaseServer.from(table).delete().in("id", body.ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (typeof body.column === "string" && body.value !== undefined) {
    const column: string = body.column
    const value: string = body.value
    const { error } = await supabaseServer.from(table).delete().eq(column, value)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: "Falta ids o column/value" }, { status: 400 })
}
