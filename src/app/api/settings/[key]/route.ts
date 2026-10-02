import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

// Duplicado deliberadamente en vez de importado desde "@/lib/store" (que
// lleva "use client"): esta ruta es una Route Handler pura de servidor y no
// debe arrastrar ese módulo ni sus dependencias de React al bundle del servidor.
const USER_ID = "8c449806-d8b4-498a-98d7-28809bb7c95a"

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  if (!key || key.length > 120) return NextResponse.json({ error: "Clave de ajuste no válida" }, { status: 400 })
  const { data, error } = await supabaseServer.from("settings").select("value").eq("key", key).maybeSingle()
  if (error) return NextResponse.json({ error: "No se pudo consultar el ajuste" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  if (!data) return NextResponse.json({ value: null }, { headers: { "Cache-Control": "no-store" } })
  return NextResponse.json({ value: (data as { value: string }).value }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  if (!key || key.length > 120) return NextResponse.json({ error: "Clave de ajuste no válida" }, { status: 400 })
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "El cuerpo JSON no es válido" }, { status: 400 }) }
  const value = body && typeof body === "object" ? (body as { value?: unknown }).value : undefined
  if (typeof value !== "string" || value.length > 2_000_000) return NextResponse.json({ error: "Valor de ajuste no válido" }, { status: 400 })
  const { error } = await supabaseServer.from("settings").upsert([{ key, value, user_id: USER_ID }])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
