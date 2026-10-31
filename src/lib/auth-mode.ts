// Modo de autenticación de la app. Interruptor reversible:
//   AUTH_MODE=supabase  → cuentas reales (Supabase Auth, email + contraseña o
//                          enlace por email) y cada usuario ve solo sus datos.
//   cualquier otro valor → modo antiguo: una sola contraseña compartida
//                          (APP_PASSWORD + cookie app-auth) y un único dueño.
// Volver atrás es tan simple como quitar AUTH_MODE en Vercel y redeplegar.
// Sin imports de servidor: lo usan proxy.ts, rutas API y tests.

/** Dueño histórico de todos los datos (las filas actuales de Moha). */
export const LEGACY_USER_ID = "8c449806-d8b4-498a-98d7-28809bb7c95a"

/** Cookie NO secreta con el id del usuario conectado (solo para que el
 * navegador sepa si cambió de usuario y limpie su caché local). */
export const USER_ID_COOKIE = "app-uid"

export function isSupabaseAuthEnabled(): boolean {
  return process.env.AUTH_MODE === "supabase"
}

/** Rutas accesibles sin sesión en modo cuentas. */
export function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/auth/callback" ||
    pathname === "/auth/confirm" ||
    pathname.startsWith("/auth/confirm/") ||
    pathname.startsWith("/api/auth/")
  )
}
