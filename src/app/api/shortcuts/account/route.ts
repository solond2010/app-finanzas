import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { resolveShortcutUser } from "@/lib/server/shortcut-auth"
import { applySaldoDelta } from "@/lib/server/saldo-delta"
import { dateKeyInTimeZone } from "@/lib/date-utils"

const TIPOS = new Set(["emergencia", "ahorro", "inversion", "efectivo", "gastos"])
const CURRENCIES = new Set(["EUR", "USD", "CHF"])
// Mismo palette que COLORS[0] en src/components/dashboard/account-dialog.tsx.
const DEFAULT_COLOR = "#10b981"


// Crea una cuenta desde el Atajo de iOS (rama "Gestionar cuentas → Crear
// cuenta"), con los mismos valores por defecto que AccountDialog para los
// campos que el Atajo no pregunta (banco, objetivo, límite mensual, color).
export async function POST(request: Request) {
  const auth = await resolveShortcutUser(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  if (!body || typeof body.nombre !== "string" || !body.nombre.trim()) {
    return NextResponse.json({ error: "Falta nombre" }, { status: 400 })
  }
  if (typeof body.tipo !== "string" || !TIPOS.has(body.tipo)) {
    return NextResponse.json({ error: "tipo debe ser emergencia, ahorro, inversion, efectivo o gastos" }, { status: 400 })
  }
  const currency = typeof body.currency === "string" && CURRENCIES.has(body.currency) ? body.currency : "EUR"
  const saldo = Number(body.saldo)
  if (!Number.isFinite(saldo)) return NextResponse.json({ error: "saldo debe ser un número" }, { status: 400 })

  const id = crypto.randomUUID()
  const { error } = await supabaseServer.from("accounts").insert({
    id,
    nombre: body.nombre.trim(),
    tipo: body.tipo,
    banco: "",
    saldo: 0,
    currency,
    objetivo: null,
    limite_mensual: null,
    color: DEFAULT_COLOR,
    user_id: auth.userId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si hay saldo inicial, se apunta como movimiento y el saldo se mueve por
  // delta. Así no queda una cuenta con saldo y sin historial.
  if (saldo !== 0) {
    const initId = `init_${id}`
    const { error: txError } = await supabaseServer.from("transactions").insert({
      id: initId,
      cuenta_id: id,
      monto: Math.abs(saldo),
      fecha: dateKeyInTimeZone(new Date(), "Europe/Madrid"),
      tipo: saldo >= 0 ? "ingreso" : "gasto",
      categoria: "Saldo inicial",
      es_necesidad: false,
      descripcion: `Saldo inicial de ${body.nombre.trim()}`,
      tags: [],
      user_id: auth.userId,
    })
    if (txError) {
      await supabaseServer.from("accounts").delete().eq("user_id", auth.userId).eq("id", id)
      return NextResponse.json({ error: txError.message }, { status: 500 })
    }
    try {
      await applySaldoDelta(supabaseServer, auth.userId, id, saldo)
    } catch (deltaError) {
      await supabaseServer.from("transactions").delete().eq("user_id", auth.userId).eq("id", initId)
      await supabaseServer.from("accounts").delete().eq("user_id", auth.userId).eq("id", id)
      return NextResponse.json({ error: deltaError instanceof Error ? deltaError.message : "No se pudo actualizar el saldo" }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, id })
}

// Elimina una cuenta desde el Atajo (rama "Gestionar cuentas → Eliminar
// cuenta"). Replica el caso DELETE_ACCOUNT del reducer (src/lib/store.tsx):
// las sinking_funds vinculadas se borran a mano (sin FK); las transactions
// se borran solas por el "on delete cascade" de accounts(id) en el esquema.
export async function DELETE(request: Request) {
  const auth = await resolveShortcutUser(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  if (!body || typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 })
  }

  const { error: sinkingFundsError } = await supabaseServer.from("sinking_funds").delete().eq("user_id", auth.userId).eq("cuenta_id", body.id)
  if (sinkingFundsError) return NextResponse.json({ error: sinkingFundsError.message }, { status: 500 })

  const { error: accountError } = await supabaseServer.from("accounts").delete().eq("user_id", auth.userId).eq("id", body.id)
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
