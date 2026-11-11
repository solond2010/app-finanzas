import "server-only"
import { googleProviderEnabledFromSettings } from "@/lib/auth-redirect"

/** Consulta el flag público de Auth. Si falla, el botón de Google no se muestra. */
export async function isGoogleAuthAvailable(): Promise<boolean> {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "")
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) return false
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 2500)
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      cache: "no-store",
      signal: ac.signal,
    })
    if (!res.ok) return false
    return googleProviderEnabledFromSettings(await res.json())
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
