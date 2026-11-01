// Modo demo: cualquiera puede ver Garra por dentro sin crear cuenta.
// Sin imports de servidor ni de navegador: lo usan proxy.ts, el layout
// (servidor) y el código del navegador.
//
// Aislamiento total: con la cookie de demo el navegador NUNCA habla con
// Supabase. Todas las llamadas a /api se contestan en memoria (ver
// src/lib/demo/runtime.ts) y localStorage se sustituye por uno en memoria,
// así la copia local de un usuario real que abra la demo no se toca.
// Recargar la página vuelve a los datos de ejemplo.

/** Cookie de sesión (sin caducidad: se borra al cerrar el navegador). */
export const DEMO_COOKIE = "garra-demo"
export const DEMO_COOKIE_VALUE = "1"

export function isDemoCookieValue(value: string | null | undefined): boolean {
  return value === DEMO_COOKIE_VALUE
}

/** Rutas de entrada y salida de la demo (públicas). */
export function isDemoEntryPath(pathname: string): boolean {
  return pathname === "/demo" || pathname === "/demo/salir"
}

/** Lee la cookie de demo de una cabecera Cookie (instrumentation.ts). */
export function hasDemoCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false
  return cookieHeader.split(";").some((part) => {
    const [k, ...rest] = part.trim().split("=")
    return k === DEMO_COOKIE && isDemoCookieValue(rest.join("="))
  })
}

export const DEMO_BLOCKED_MESSAGE = "Esto no está disponible en la demo. Crea tu cuenta gratis para usarlo."

/** Enlaces del aviso de demo (navegación completa: así se sale del modo demo). */
export const DEMO_SIGNUP_HREF = "/demo/salir?a=registro"
export const DEMO_EXIT_HREF = "/demo/salir"
