import { NextResponse } from "next/server"
import { getDataContext, unauthorizedResponse } from "@/lib/server/request-context"

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  if (!key || key.length > 120) return NextResponse.json({ error: "Clave de ajuste no válida" }, { status: 400 })
  const ctx = await getDataContext()
  if (!ctx) return unauthorizedResponse()
  const { data, error } = await ctx.db.from("settings").select("value").eq("user_id", ctx.userId).eq("key", key).maybeSingle()
  if (error) return NextResponse.json({ error: "No se pudo consultar el ajuste" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  if (!data) return NextResponse.json({ value: null }, { headers: { "Cache-Control": "no-store" } })
  return NextResponse.json({ value: (data as { value: string }).value }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  if (!key || key.length > 120) return NextResponse.json({ error: "Clave de ajuste no válida" }, { status: 400 })
  const ctx = await getDataContext()
  if (!ctx) return unauthorizedResponse()
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "El cuerpo JSON no es válido" }, { status: 400 }) }
  const value = body && typeof body === "object" ? (body as { value?: unknown }).value : undefined
  if (typeof value !== "string" || value.length > 2_000_000) return NextResponse.json({ error: "Valor de ajuste no válido" }, { status: 400 })
  const { error } = await ctx.db.from("settings").upsert([{ key, value, user_id: ctx.userId }])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
