import type { Instrumentation } from "next"

// Errores del servidor (páginas, rutas API, acciones) → tabla app_errors,
// para que Moha se entere sin que nadie se lo cuente. Ver
// src/lib/server/error-log.ts (limpieza de datos y límites).
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  // El propio endpoint de avisos no se vigila a sí mismo (evita bucles).
  if (request.path.startsWith("/api/errors")) return
  try {
    const { logServerError } = await import("@/lib/server/error-log")
    const ua = request.headers["user-agent"]
    await logServerError(err, request.path, context.routeType, Array.isArray(ua) ? ua[0] ?? null : ua ?? null)
  } catch {
    // Registrar un error nunca debe provocar otro.
  }
}
