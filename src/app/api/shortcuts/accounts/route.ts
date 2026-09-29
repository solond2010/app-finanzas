import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { timingSafeEqualString } from "@/lib/auth"

// Lista de cuentas para que el Atajo de iOS construya su selector "Elegir de
// la lista" en el momento, en vez de tener nombres/IDs pegados a mano — así
// nunca hace falta editar el Atajo cuando se crea o borra una cuenta.
export async function GET(request: Request) {
  const secret = process.env.SHORTCUTS_SECRET
  if (!secret) return NextResponse.json({ error: "SHORTCUTS_SECRET no configurado" }, { status: 503 })

  const provided = request.headers.get("x-shortcuts-secret")
  if (!provided || !timingSafeEqualString(provided, secret)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // El Atajo pide esta lista cada vez que se abre. Deja explícito que tanto
  // Vercel como los clientes intermedios no deben conservar cuentas antiguas.
  const { data, error } = await supabaseServer
    .from("accounts")
    .select("id, nombre, banco, tipo, currency")
    .order("nombre", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const accounts = (data ?? []).map((account) => ({
    // Shortcuts presenta el valor `Name` como etiqueta al elegir un elemento
    // de una lista de diccionarios; el id viaja aparte y no se muestra.
    Name: [account.nombre, account.banco || account.tipo, account.currency || "EUR"].join(" · "),
    id: account.id,
  }))

  return NextResponse.json(
    { accounts },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  )
}
