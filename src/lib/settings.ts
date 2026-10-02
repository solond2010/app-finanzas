import { settingsGet, settingsSet } from "./db-client"

// Ajustes simples clave-valor en la nube (tabla `settings`). Sirve para cosas
// como el objetivo de ingresos, que antes vivían solo en localStorage.
export async function getSetting(key: string): Promise<string | null | undefined> {
  return settingsGet(key)
}

export async function setSetting(key: string, value: string): Promise<boolean> {
  const saved = await settingsSet(key, value)
  if (!saved) console.error(`[Finance] No se pudo guardar el ajuste "${key}" en la nube.`)
  return saved
}
