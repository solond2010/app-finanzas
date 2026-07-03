import { settingsGet, settingsSet } from "./db-client"

// Ajustes simples clave-valor en la nube (tabla `settings`). Sirve para cosas
// como el objetivo de ingresos, que antes vivían solo en localStorage.
export async function getSetting(key: string): Promise<string | null> {
  return settingsGet(key)
}

export async function setSetting(key: string, value: string): Promise<void> {
  return settingsSet(key, value)
}
