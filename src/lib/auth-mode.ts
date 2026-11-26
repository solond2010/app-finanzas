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
    pathname === "/auth/reset" ||
    pathname.startsWith("/api/auth/") ||
    // Avisos de error: también desde /login (sin sesión). Solo admite INSERT,
    // con límite por IP y sin datos financieros (ver api/errors/route.ts).
    pathname === "/api/errors" ||
    // Comentarios: la propia ruta exige sesión, salvo a quien está en la
    // demo (cookie garra-demo), que los envía de forma anónima y con límite.
    pathname === "/api/feedback" ||
    // Avisos de Stripe: llegan sin sesión y se validan por firma.
    pathname === "/api/billing/webhook" ||
    // Páginas legales: públicas (se enlazan desde la pantalla de entrada).
    pathname === "/privacidad" ||
    pathname === "/terminos" ||
    pathname === "/precios" ||
    pathname === "/mcp" ||
    // Registro vive en /login?modo=registro; esta ruta redirige ahí.
    pathname === "/registro" ||
    // robots y sitemap deben ser públicos (si no, el proxy manda a /login).
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    // MCP remoto: se autentica con un token personal, no con la cookie de sesión.
    pathname === "/api/mcp" ||
    pathname.startsWith("/api/mcp/") ||
    // OAuth 2.1 del MCP: metadatos, registro, token y consentimiento.
    pathname === "/.well-known/oauth-protected-resource" ||
    pathname.startsWith("/.well-known/oauth-protected-resource/") ||
    pathname === "/.well-known/oauth-authorization-server" ||
    pathname.startsWith("/oauth/")
  )
}

/** Usuarios que ven la sección de administración (comentarios y errores).
 * Por defecto solo Moha; se puede ampliar con GARRA_ADMIN_USER_IDS
 * (ids separados por comas). La base de datos aplica la misma regla con la
 * tabla app_admins (ver supabase/2026-11-fase3-beta.sql). */
export function isAdminUserId(userId: string | null | undefined, configured = process.env.GARRA_ADMIN_USER_IDS): boolean {
  if (!userId) return false
  const extra = (configured ?? "").split(",").map((id) => id.trim()).filter(Boolean)
  return userId === LEGACY_USER_ID || extra.includes(userId)
}
