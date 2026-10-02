"use client"

// Sustituye al cliente de Supabase en el navegador: en vez de hablar
// directamente con Supabase (lo que exponía la URL y la clave anon en el
// bundle), el navegador solo habla con nuestras propias rutas /api/data,
// /api/settings y /api/storage, protegidas por la misma cookie de sesión que
// ya usa el middleware de la app.

async function parseJson(res: Response) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function dbSelect<T>(table: string, fields = "*"): Promise<T[] | null> {
  try {
    const res = await fetch(`/api/data/${table}?fields=${encodeURIComponent(fields)}`)
    if (!res.ok) return null
    const body = await parseJson(res)
    return (body?.data as T[]) ?? null
  } catch {
    return null
  }
}

export async function dbUpsert(table: string, rows: unknown[]): Promise<void> {
  const res = await fetch(`/api/data/${table}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  })
  if (!res.ok) {
    const body = await parseJson(res)
    throw new Error(body?.error ?? `Fallo al guardar en ${table}`)
  }
}

export async function dbDeleteEq(table: string, column: string, value: string): Promise<void> {
  const res = await fetch(`/api/data/${table}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ column, value }),
  })
  if (!res.ok) {
    const body = await parseJson(res)
    throw new Error(body?.error ?? `Fallo al borrar en ${table}`)
  }
}

export async function dbDeleteIn(table: string, ids: string[]): Promise<void> {
  const res = await fetch(`/api/data/${table}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) {
    const body = await parseJson(res)
    throw new Error(body?.error ?? `Fallo al borrar en ${table}`)
  }
}

export async function settingsGet(key: string): Promise<string | null | undefined> {
  try {
    const res = await fetch(`/api/settings/${encodeURIComponent(key)}`)
    if (!res.ok) return undefined
    const body = await parseJson(res)
    if (body?.value === null || body?.value === undefined) return null
    return typeof body.value === "string" ? body.value : undefined
  } catch {
    return undefined
  }
}

export async function settingsSet(key: string, value: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/settings/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function uploadLogo(file: File, path: string): Promise<string> {
  const form = new FormData()
  form.append("file", file)
  form.append("path", path)
  const res = await fetch("/api/storage/bank-logos", { method: "POST", body: form })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(body?.error ?? "Fallo al subir el logo")
  return body.url as string
}
