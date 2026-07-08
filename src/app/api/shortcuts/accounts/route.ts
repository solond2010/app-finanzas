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

  const { data, error } = await supabaseServer.from("accounts").select("id, nombre, tipo, saldo, currency")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ accounts: data })
}
