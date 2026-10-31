import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { resolveShortcutUser } from "@/lib/server/shortcut-auth"

// Lista de cuentas para que el Atajo de iOS construya su selector "Elegir de
// la lista" en el momento, en vez de tener nombres/IDs pegados a mano — así
// nunca hace falta editar el Atajo cuando se crea o borra una cuenta.
export async function GET(request: Request) {
  const auth = await resolveShortcutUser(request)
  if (auth instanceof NextResponse) return auth

  // El Atajo pide esta lista cada vez que se abre. Deja explícito que tanto
  // Vercel como los clientes intermedios no deben conservar cuentas antiguas.
  const { data, error } = await supabaseServer
    .from("accounts")
    .select("id, nombre, banco, tipo, currency")
    .eq("user_id", auth.userId)
    .order("nombre", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const accounts = (data ?? []).map((account) => ({
    // Shortcuts presenta el valor `Name` como etiqueta al elegir un elemento
    // de una lista de diccionarios; el id viaja aparte y no se muestra.
    Name: [account.nombre, account.banco || account.tipo, account.currency || "EUR"].join(" · "),
    id: account.id,
  }))

  // Para el Atajo compartido (public/atajos): «names» va al selector «Elegir
  // de la lista» y «map» traduce el nombre elegido a su id. Shortcuts lee los
  // puntos de una clave como ruta anidada, así que se cambian por «․» (U+2024,
  // se ve igual) y los nombres repetidos se numeran para que el mapa no pise.
  const names: string[] = []
  const map: Record<string, string> = {}
  for (const account of accounts) {
    const base = account.Name.replace(/\./g, "\u2024")
    let label = base
    for (let n = 2; Object.prototype.hasOwnProperty.call(map, label); n++) label = `${base} (${n})`
    names.push(label)
    map[label] = account.id
  }

  return NextResponse.json(
    { accounts, names, map },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  )
}
