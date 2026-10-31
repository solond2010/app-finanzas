import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { resolveShortcutUser } from "@/lib/server/shortcut-auth"
import { AUTO_CATEGORY } from "@/lib/shortcut-messages"

export async function GET(request: Request) {
  const auth = await resolveShortcutUser(request)
  if (auth instanceof NextResponse) return auth

  const { data, error } = await supabaseServer
    .from("categories")
    .select("id, name, kind")
    .eq("user_id", auth.userId)
    .order("name", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const kind = new URL(request.url).searchParams.get("tipo")
  const filtered = kind === "gasto" || kind === "ingreso"
    ? (data ?? []).filter((category) => !category.kind || category.kind === kind || category.kind === "both")
    : data
  const names = (filtered ?? []).map((category) => category.name)
  // Cuenta recién creada sin categorías guardadas aún: el Atajo necesita al
  // menos una opción; «Automática» deja que movement la adivine.
  const categories = names.length > 0 ? names : [AUTO_CATEGORY]

  return NextResponse.json(
    { categories },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  )
}
