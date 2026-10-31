import { LEGACY_USER_ID, USER_ID_COOKIE } from "./auth-mode"

// La app guarda una copia local (localStorage) de los datos para ir rápida y
// no perder cambios sin conexión. Con varias cuentas, si en el mismo
// navegador entra OTRA persona, esa copia no puede mostrarse ni subirse a su
// cuenta. Aquí se compara el dueño de la copia con el usuario conectado y, si
// cambia, se vacía todo salvo las preferencias visuales.

export const LOCAL_OWNER_KEY = "app-finanzas-owner"
const KEEP_KEYS = new Set(["app-finanzas-theme", LOCAL_OWNER_KEY])

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">

export function readCookie(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(";")) {
    const [k, ...rest] = part.trim().split("=")
    if (k === name) return decodeURIComponent(rest.join("="))
  }
  return null
}

/** Devuelve true si se vació la copia local. */
export function ensureLocalCacheOwner(storage: StorageLike, cookieString: string): boolean {
  const current = readCookie(cookieString, USER_ID_COOKIE)
  if (!current) return false // modo contraseña única: nada que hacer
  const owner = storage.getItem(LOCAL_OWNER_KEY)
  if (owner === current) return false
  // Copia sin dueño registrado = la de siempre de Moha (dueño histórico).
  const isLegacyCopy = owner === null && current === LEGACY_USER_ID
  let cleared = false
  if (!isLegacyCopy) {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key && !KEEP_KEYS.has(key)) keys.push(key)
    }
    keys.forEach((key) => storage.removeItem(key))
    cleared = keys.length > 0
  }
  storage.setItem(LOCAL_OWNER_KEY, current)
  return cleared
}

let checked = false

/** Se llama al pintar el layout, antes de que los providers lean la copia. */
export function ensureLocalCacheOwnerOnce() {
  if (checked || typeof window === "undefined") return
  checked = true
  try {
    ensureLocalCacheOwner(window.localStorage, document.cookie)
  } catch {
    // Sin localStorage (modo privado estricto): no hay copia que proteger.
  }
}
