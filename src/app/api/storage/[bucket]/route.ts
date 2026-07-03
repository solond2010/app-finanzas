import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

const ALLOWED_BUCKETS = new Set(["bank-logos"])

export async function POST(request: Request, { params }: { params: Promise<{ bucket: string }> }) {
  const { bucket } = await params
  if (!ALLOWED_BUCKETS.has(bucket)) return NextResponse.json({ error: "Bucket no permitido" }, { status: 400 })

  const form = await request.formData()
  const file = form.get("file")
  const path = form.get("path")
  if (!(file instanceof File) || typeof path !== "string" || !path) {
    return NextResponse.json({ error: "Falta file o path" }, { status: 400 })
  }

  const { error } = await supabaseServer.storage.from(bucket).upload(path, file, { upsert: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = supabaseServer.storage.from(bucket).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
