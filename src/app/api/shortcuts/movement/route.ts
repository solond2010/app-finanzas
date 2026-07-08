import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { timingSafeEqualString } from "@/lib/auth"
import { guessCategory } from "@/lib/guess-category"

// Mismo USER_ID hardcodeado que usa el resto de la app (ver USER_ID en
// src/lib/store.tsx) — duplicado como literal en vez de importado porque
// store.tsx es "use client" y esta ruta no necesita nada más de ese módulo.
const USER_ID = "8c449806-d8b4-498a-98d7-28809bb7c95a"

// Endpoint pensado para un Atajo de iOS disparado a mano (Toque Trasero o
// icono en pantalla de inicio, no una automatización de Apple Pay): registra
// un gasto, ingreso o traspaso sin pasar por el reducer del navegador (no hay
// sesión abierta). No usa la cookie app-auth (proxy.ts excluye esta ruta del
// gate de contraseña) — la única protección es el secreto propio de aquí.
export async function POST(request: Request) {
  const secret = process.env.SHORTCUTS_SECRET
  if (!secret) return NextResponse.json({ error: "SHORTCUTS_SECRET no configurado" }, { status: 503 })

  const provided = request.headers.get("x-shortcuts-secret")
  if (!provided || !timingSafeEqualString(provided, secret)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || (body.tipo !== "gasto" && body.tipo !== "ingreso" && body.tipo !== "traspaso")) {
    return NextResponse.json({ error: "tipo debe ser gasto, ingreso o traspaso" }, { status: 400 })
  }

  // El Atajo de iOS interpola el número como texto usando el formato del
  // dispositivo (España = coma decimal, ej. "12,50"), así que Number()
  // directamente daría NaN. Se normaliza la coma a punto antes de parsear.
  const montoRaw = typeof body.monto === "string" ? body.monto.replace(",", ".") : body.monto
  const monto = Number(montoRaw)
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: "monto debe ser un número mayor que 0" }, { status: 400 })
  }

  const descripcion = typeof body.descripcion === "string" && body.descripcion.trim() ? body.descripcion.trim() : "Movimiento rápido"
  const fecha = typeof body.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.fecha)
    ? body.fecha
    : new Date().toISOString().slice(0, 10)

  async function getAccount(id: unknown) {
    if (typeof id !== "string" || !id) return null
    const { data, error } = await supabaseServer.from("accounts").select("id, nombre, saldo").eq("id", id).single()
    if (error || !data) return null
    return data as { id: string; nombre: string; saldo: number }
  }

  if (body.tipo === "traspaso") {
    const origen = await getAccount(body.origen_id)
    const destino = await getAccount(body.destino_id)
    if (!origen || !destino) return NextResponse.json({ error: "origen_id o destino_id no existen" }, { status: 400 })
    if (origen.id === destino.id) return NextResponse.json({ error: "origen_id y destino_id deben ser distintos" }, { status: 400 })

    // Misma pareja de movimientos que handleTransfer() en
    // src/components/layout/quick-actions.tsx.
    const { error: insertError } = await supabaseServer.from("transactions").insert([
      {
        id: crypto.randomUUID(),
        cuenta_id: origen.id,
        monto,
        fecha,
        tipo: "gasto",
        categoria: "Transferencia",
        es_necesidad: false,
        descripcion: `${descripcion} → ${destino.nombre}`,
        tags: ["traspaso", "atajo"],
        user_id: USER_ID,
        created_at: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        cuenta_id: destino.id,
        monto,
        fecha,
        tipo: "ingreso",
        categoria: "Transferencia",
        es_necesidad: false,
        descripcion: `${descripcion} ← ${origen.nombre}`,
        tags: ["traspaso", "atajo"],
        user_id: USER_ID,
        created_at: new Date().toISOString(),
      },
    ])
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    const { error: updateOrigenError } = await supabaseServer.from("accounts").update({ saldo: origen.saldo - monto }).eq("id", origen.id)
    if (updateOrigenError) return NextResponse.json({ error: updateOrigenError.message }, { status: 500 })
    const { error: updateDestinoError } = await supabaseServer.from("accounts").update({ saldo: destino.saldo + monto }).eq("id", destino.id)
    if (updateDestinoError) return NextResponse.json({ error: updateDestinoError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  }

  const account = await getAccount(body.cuenta_id)
  if (!account) return NextResponse.json({ error: "cuenta_id no existe" }, { status: 400 })

  const id = crypto.randomUUID()
  const { error: insertError } = await supabaseServer.from("transactions").insert({
    id,
    cuenta_id: account.id,
    monto,
    fecha,
    tipo: body.tipo,
    categoria: guessCategory(descripcion, body.tipo),
    es_necesidad: false,
    descripcion,
    tags: ["atajo"],
    user_id: USER_ID,
    created_at: new Date().toISOString(),
  })
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const newSaldo = body.tipo === "ingreso" ? account.saldo + monto : account.saldo - monto
  const { error: updateError } = await supabaseServer.from("accounts").update({ saldo: newSaldo }).eq("id", account.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true, id })
}
