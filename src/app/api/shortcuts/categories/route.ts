import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { timingSafeEqualString } from "@/lib/auth"

export async function GET(request: Request) {
  const secret = process.env.SHORTCUTS_SECRET
  if (!secret) return NextResponse.json({ error: "SHORTCUTS_SECRET no configurado" }, { status: 503 })

  const provided = request.headers.get("x-shortcuts-secret")
  if (!provided || !timingSafeEqualString(provided, secret)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { data, error } = await supabaseServer
    .from("categories")
    .select("id, name, kind")
    .order("name", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const kind = new URL(request.url).searchParams.get("tipo")
  const filtered = kind === "gasto" || kind === "ingreso"
    ? (data ?? []).filter((category) => !category.kind || category.kind === kind || category.kind === "both")
    : data
  const categories = (filtered ?? []).map((category) => category.name)

  return NextResponse.json(
    { categories },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  )
}
