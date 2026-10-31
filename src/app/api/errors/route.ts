import { getClientIp, json, readJson } from "@/lib/server/auth-helpers"
import { getDataContext } from "@/lib/server/request-context"
import { saveErrorReport } from "@/lib/server/error-log"
import { createRateLimiter, isIgnorableClientError, sanitizeErrorReport } from "@/lib/error-report"

// Avisos de error del navegador. Público (también llegan desde /login), pero
// solo guarda: máximo 10 por IP y minuto, textos recortados y sin importes,
// emails ni claves. La base de datos añade su propio tope global.
const allowIp = createRateLimiter(10, 60_000)

export async function POST(request: Request) {
  if (!allowIp(getClientIp(request))) return json({ ok: false }, 429)
  const body = await readJson(request)
  if (!body) return json({ ok: false }, 400)
  const report = sanitizeErrorReport({ ...body, userAgent: request.headers.get("user-agent") }, "navegador")
  if (isIgnorableClientError(report.message)) return json({ ok: true, ignored: true })
  const ctx = await getDataContext().catch(() => null)
  const saved = await saveErrorReport(report, ctx?.userId ?? null, ctx?.db)
  return json({ ok: saved })
}
