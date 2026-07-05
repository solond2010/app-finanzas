import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { timingSafeEqualString } from "@/lib/auth"

// Mismo USER_ID hardcodeado que usa el resto de la app (ver USER_ID en
// src/lib/store.tsx) — duplicado como literal en vez de importado porque
// store.tsx es "use client" y esta ruta no necesita nada más de ese módulo.
const USER_ID = "8c449806-d8b4-498a-98d7-28809bb7c95a"

// Endpoint pensado para un Atajo de iOS (disparador "Transacción"/"Wallet" de
// Apple Pay, ver plan de la conversación): registra un gasto y descuenta el
// saldo de la cuenta sin pasar por el reducer del navegador (no hay sesión
// abierta). No usa la cookie app-auth (proxy.ts excluye esta ruta del gate de
// contraseña) — la única protección es el secreto propio de aquí.
export async function POST(request: Request) {
  const secret = process.env.SHORTCUTS_SECRET
  if (!secret) return NextResponse.json({ error: "SHORTCUTS_SECRET no configurado" }, { status: 503 })

  const provided = request.headers.get("x-shortcuts-secret")
  if (!provided || !timingSafeEqualString(provided, secret)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.cuenta_id !== "string" || !body.cuenta_id) {
    return NextResponse.json({ error: "Falta cuenta_id" }, { status: 400 })
  }

  const monto = Number(body.monto)
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: "monto debe ser un número mayor que 0" }, { status: 400 })
  }

  const descripcion = typeof body.descripcion === "string" && body.descripcion.trim() ? body.descripcion.trim() : "Apple Pay"
  const fecha = typeof body.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.fecha)
    ? body.fecha
    : new Date().toISOString().slice(0, 10)

  const { data: account, error: accountError } = await supabaseServer
    .from("accounts")
    .select("id, saldo")
    .eq("id", body.cuenta_id)
    .single()
  if (accountError || !account) {
    return NextResponse.json({ error: "cuenta_id no existe" }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const { error: insertError } = await supabaseServer.from("transactions").insert({
    id,
    cuenta_id: body.cuenta_id,
    monto,
    fecha,
    tipo: "gasto",
    // `categoria` guarda el NOMBRE de la categoría, no su id (así lo
    // resuelve transactions-table.tsx: `categories.find(c => c.name === t.categoria)`).
    categoria: "Otros",
    es_necesidad: false,
    descripcion,
    tags: ["apple-pay"],
    user_id: USER_ID,
    created_at: new Date().toISOString(),
  })
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const { error: updateError } = await supabaseServer
    .from("accounts")
    .update({ saldo: account.saldo - monto })
    .eq("id", body.cuenta_id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true, id })
}
