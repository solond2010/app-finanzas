import { isIgnorableClientError } from "@/lib/error-report"

// Envía un error del navegador a /api/errors. Como mucho 5 avisos por carga
// de página y nunca el mismo mensaje dos veces: un fallo en bucle no inunda
// la tabla (el servidor y la base de datos tienen además sus propios topes).
const seen = new Set<string>()
let sent = 0
const MAX_PER_PAGE = 5

export function reportClientError(error: unknown, extra?: { digest?: string }) {
  if (typeof window === "undefined") return
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Error desconocido")
  const message = err.message || "Error sin mensaje"
  if (isIgnorableClientError(message) || isIgnorableClientError(err.stack ?? "")) return
  const key = message.slice(0, 200)
  if (seen.has(key) || sent >= MAX_PER_PAGE) return
  seen.add(key)
  sent += 1
  try {
    void fetch("/api/errors", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        stack: err.stack ?? null,
        digest: extra?.digest ?? (err as Error & { digest?: string }).digest ?? null,
        route: window.location.pathname,
      }),
    }).catch(() => {})
  } catch {
    // Avisar de un error nunca debe provocar otro.
  }
}
