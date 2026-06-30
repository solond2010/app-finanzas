import { supabase } from "./supabase"
import { USER_ID } from "./store"

// Ajustes simples clave-valor en la nube (tabla `settings`). Sirve para cosas
// como el objetivo de ingresos, que antes vivían solo en localStorage.
export async function getSetting(key: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle()
    if (error || !data) return null
    return (data as { value: string }).value
  } catch {
    return null
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await supabase.from("settings").upsert([{ key, value, user_id: USER_ID }])
  } catch {
    // sin tabla / sin red → no pasa nada
  }
}
