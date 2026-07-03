import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

// Duplicado deliberadamente en vez de importado desde "@/lib/store" (que
// lleva "use client"): esta ruta es una Route Handler pura de servidor y no
// debe arrastrar ese módulo ni sus dependencias de React al bundle del servidor.
const USER_ID = "8c449806-d8b4-498a-98d7-28809bb7c95a"

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const { data, error } = await supabaseServer.from("settings").select("value").eq("key", key).maybeSingle()
  if (error || !data) return NextResponse.json({ value: null })
  return NextResponse.json({ value: (data as { value: string }).value })
}

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const { value } = await request.json()
  const { error } = await supabaseServer.from("settings").upsert([{ key, value, user_id: USER_ID }])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
