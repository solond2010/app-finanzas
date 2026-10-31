import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { supabaseServer } from "@/lib/supabase-server"
import { createRateLimiter, sanitizeErrorReport, type ErrorReport } from "@/lib/error-report"

/** Guarda un aviso ya limpio en app_errors. Nunca lanza. */
export async function saveErrorReport(report: ErrorReport, userId: string | null, db?: SupabaseClient): Promise<boolean> {
  try {
    const { error } = await (db ?? supabaseServer).from("app_errors").insert({
      source: report.source,
      route: report.route,
      message: report.message,
      stack: report.stack,
      digest: report.digest,
      user_agent: report.userAgent,
      user_id: userId,
    })
    if (error) console.warn("[app_errors] no se pudo guardar:", error.message)
    return !error
  } catch {
    return false
  }
}

// Un mismo fallo de servidor repetido en bucle no llena la tabla: máximo 3
// avisos por mensaje y minuto en cada instancia (y la base de datos corta
// además a 60 por minuto en total).
const allowServerError = createRateLimiter(3, 60_000)

export async function logServerError(error: unknown, path: string | null, routeType: string | null, userAgent: string | null) {
  const err = error instanceof Error ? error : new Error(String(error))
  const digest = (err as Error & { digest?: string }).digest ?? null
  if (!allowServerError(err.message.slice(0, 200))) return
  const report = sanitizeErrorReport({
    message: routeType ? `[${routeType}] ${err.message}` : err.message,
    stack: err.stack ?? null,
    digest,
    route: path,
    userAgent,
  }, "servidor")
  await saveErrorReport(report, null)
}
