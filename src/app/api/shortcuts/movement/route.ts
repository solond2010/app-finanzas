import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { timingSafeEqualString } from "@/lib/auth"
import { guessCategory } from "@/lib/guess-category"
import { dateKeyInTimeZone, isDateKey } from "@/lib/date-utils"

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
  const fecha = body.fecha === undefined || body.fecha === null || body.fecha === ""
    ? dateKeyInTimeZone(new Date(), "Europe/Madrid")
    : typeof body.fecha === "string" && isDateKey(body.fecha)
      ? body.fecha
      : null
  if (!fecha) return NextResponse.json({ error: "fecha debe ser una fecha válida con formato YYYY-MM-DD" }, { status: 400 })
  let shortcutId: string | null = null
  if (body.idempotency_key !== undefined) {
    if (typeof body.idempotency_key !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(body.idempotency_key)) {
      return NextResponse.json({ error: "idempotency_key no es válido" }, { status: 400 })
    }
    shortcutId = `shortcut_${body.idempotency_key}`
  }

  async function transactionExists(id: string) {
    const { data, error } = await supabaseServer.from("transactions").select("id").eq("id", id).maybeSingle()
    if (error) throw error
    return Boolean(data)
  }

  async function getAccount(id: unknown) {
    if (typeof id !== "string" || !id) return null
    const { data, error } = await supabaseServer.from("accounts").select("id, nombre, saldo, currency").eq("id", id).single()
    if (error || !data) return null
    return data as { id: string; nombre: string; saldo: number | string; currency: string | null }
  }

  async function convertTransferAmount(amount: number, from: string, to: string) {
    if (from === to) return amount
    const response = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,CHF", {
      next: { revalidate: 3600 },
    })
    if (!response.ok) throw new Error("No se pudo obtener el cambio de divisa")
    const rates = (await response.json()) as { rates?: Record<string, number> }
    const eurPerUnit: Record<string, number> = {
      EUR: 1,
      USD: 1 / Number(rates.rates?.USD),
      CHF: 1 / Number(rates.rates?.CHF),
    }
    if (!eurPerUnit[from] || !eurPerUnit[to]) throw new Error("Divisa no compatible con la conversión")
    return Math.round((amount * eurPerUnit[from] / eurPerUnit[to]) * 100) / 100
  }

  if (body.tipo === "traspaso") {
    const origen = await getAccount(body.origen_id)
    const destino = await getAccount(body.destino_id)
    if (!origen || !destino) return NextResponse.json({ error: "origen_id o destino_id no existen" }, { status: 400 })
    if (origen.id === destino.id) return NextResponse.json({ error: "origen_id y destino_id deben ser distintos" }, { status: 400 })

    const sourceCurrency = origen.currency || "EUR"
    const destinationCurrency = destino.currency || "EUR"
    let destinationAmount = monto
    try {
      destinationAmount = await convertTransferAmount(monto, sourceCurrency, destinationCurrency)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo convertir el traspaso" }, { status: 503 })
    }

    const sourceTransactionId = shortcutId ? `${shortcutId}_out` : crypto.randomUUID()
    const destinationTransactionId = shortcutId ? `${shortcutId}_in` : crypto.randomUUID()
    const pairTag = `traspaso:${shortcutId ?? crypto.randomUUID()}`
    if (shortcutId) {
      try {
        const [sourceExists, destinationExists] = await Promise.all([
          transactionExists(sourceTransactionId),
          transactionExists(destinationTransactionId),
        ])
        if (sourceExists && destinationExists) return NextResponse.json({ ok: true, duplicate: true })
        if (sourceExists || destinationExists) {
          return NextResponse.json({ error: "Este traspaso quedó incompleto y necesita revisión" }, { status: 409 })
        }
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo comprobar el movimiento" }, { status: 500 })
      }
    }

    // Misma pareja de movimientos que handleTransfer() en
    // src/components/layout/quick-actions.tsx.
    const { error: insertError } = await supabaseServer.from("transactions").insert([
      {
        id: sourceTransactionId,
        cuenta_id: origen.id,
        monto,
        fecha,
        tipo: "gasto",
        categoria: "Transferencia",
        es_necesidad: false,
        descripcion: `${descripcion} → ${destino.nombre}`,
        tags: ["traspaso", "atajo", pairTag],
        user_id: USER_ID,
        created_at: new Date().toISOString(),
      },
      {
        id: destinationTransactionId,
        cuenta_id: destino.id,
        monto: destinationAmount,
        fecha,
        tipo: "ingreso",
        categoria: "Transferencia",
        es_necesidad: false,
        descripcion: `${descripcion} ← ${origen.nombre}`,
        tags: ["traspaso", "atajo", pairTag],
        user_id: USER_ID,
        created_at: new Date().toISOString(),
      },
    ])
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    const { error: updateOrigenError } = await supabaseServer.from("accounts").update({ saldo: Number(origen.saldo) - monto }).eq("id", origen.id)
    if (updateOrigenError) return NextResponse.json({ error: updateOrigenError.message }, { status: 500 })
    const { error: updateDestinoError } = await supabaseServer.from("accounts").update({ saldo: Number(destino.saldo) + destinationAmount }).eq("id", destino.id)
    if (updateDestinoError) return NextResponse.json({ error: updateDestinoError.message }, { status: 500 })

    return NextResponse.json({ ok: true, origen: { monto, currency: sourceCurrency }, destino: { monto: destinationAmount, currency: destinationCurrency } })
  }

  let categoria = guessCategory(descripcion, body.tipo)
  if (typeof body.categoria === "string" && body.categoria.trim()) {
    const selectedCategory = body.categoria.trim()
    const { data: category, error: categoryError } = await supabaseServer
      .from("categories")
      .select("name, kind")
      .eq("name", selectedCategory)
      .maybeSingle()
    if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 })
    if (!category || (category.kind && category.kind !== body.tipo && category.kind !== "both")) {
      return NextResponse.json({ error: "La categoría no existe o no corresponde al tipo de movimiento" }, { status: 400 })
    }
    categoria = category.name
  }

  const account = await getAccount(body.cuenta_id)
  if (!account) return NextResponse.json({ error: "cuenta_id no existe" }, { status: 400 })

  const id = shortcutId ?? crypto.randomUUID()
  if (shortcutId) {
    try {
      if (await transactionExists(id)) return NextResponse.json({ ok: true, id, duplicate: true })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo comprobar el movimiento" }, { status: 500 })
    }
  }
  const { error: insertError } = await supabaseServer.from("transactions").insert({
    id,
    cuenta_id: account.id,
    monto,
    fecha,
    tipo: body.tipo,
    categoria,
    es_necesidad: false,
    descripcion,
    tags: ["atajo"],
    user_id: USER_ID,
    created_at: new Date().toISOString(),
  })
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const newSaldo = body.tipo === "ingreso" ? Number(account.saldo) + monto : Number(account.saldo) - monto
  const { error: updateError } = await supabaseServer.from("accounts").update({ saldo: newSaldo }).eq("id", account.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true, id })
}
