import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { getDataContext, unauthorizedResponse } from "@/lib/server/request-context"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { userStoragePath } from "@/lib/user-scope"

const ALLOWED_BUCKETS = new Set(["bank-logos"])

export async function POST(request: Request, { params }: { params: Promise<{ bucket: string }> }) {
  const { bucket } = await params
  if (!ALLOWED_BUCKETS.has(bucket)) return NextResponse.json({ error: "Bucket no permitido" }, { status: 400 })

  const ctx = await getDataContext()
  if (!ctx) return unauthorizedResponse()

  const form = await request.formData()
  const file = form.get("file")
  const path = form.get("path")
  if (!(file instanceof File) || typeof path !== "string" || !path) {
    return NextResponse.json({ error: "Falta file o path" }, { status: 400 })
  }

  // En modo cuentas cada usuario sube dentro de su carpeta (<user_id>/...),
  // así nadie puede pisar el logo de otro. El bucket no tiene políticas de
  // escritura para clientes: sube el servidor con su clave, tras comprobar
  // la sesión. En modo antiguo la ruta queda igual que siempre.
  const finalPath = isSupabaseAuthEnabled() ? userStoragePath(ctx.userId, path) : path
  if (!finalPath) return NextResponse.json({ error: "Ruta de archivo no válida" }, { status: 400 })
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "El logo no puede superar 2 MB" }, { status: 400 })

  const { error } = await supabaseServer.storage.from(bucket).upload(finalPath, file, { upsert: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = supabaseServer.storage.from(bucket).getPublicUrl(finalPath)
  return NextResponse.json({ url: data.publicUrl })
}
