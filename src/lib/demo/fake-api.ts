import { buildDemoDatabase, DEMO_QUOTES, type DemoDatabase } from "./data"
import { DEMO_BLOCKED_MESSAGE } from "./constants"

// «Servidor» en memoria de la demo: contesta las mismas rutas /api que usa
// la app, sin red y sin Supabase. Lo que se guarda vive solo en esta pestaña
// y se pierde al recargar.

type Row = Record<string, unknown>

const KEY_FIELD: Record<string, string> = { watchlist: "symbol" }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

const blocked = () => json({ error: DEMO_BLOCKED_MESSAGE }, 403)

function parseBody(body: string | null): Record<string, unknown> {
  if (!body) return {}
  try {
    const value = JSON.parse(body) as unknown
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function demoHistory(symbol: string, now: number) {
  const quote = DEMO_QUOTES[symbol]
  if (!quote) return []
  const points: { t: number; c: number }[] = []
  const days = 365
  for (let i = days; i >= 0; i--) {
    const progress = (days - i) / days
    // Subida suave con algo de vaivén: termina en el precio de hoy.
    const wave = Math.sin(i / 9) * 0.015 + Math.sin(i / 37) * 0.03
    const c = quote.price * (0.86 + 0.14 * progress) * (1 + wave * (1 - progress * 0.6))
    points.push({ t: Math.floor((now - i * 86_400_000) / 1000), c: Math.round(c * 100) / 100 })
  }
  points[points.length - 1].c = quote.price
  return points
}

export function createDemoApi(now: () => Date = () => new Date()) {
  const db: DemoDatabase = buildDemoDatabase(now())
  const table = (name: string): Row[] => (db.tables[name] ??= [])

  async function handle(method: string, url: URL, body: string | null): Promise<Response> {
    const path = url.pathname
    const parts = path.split("/").filter(Boolean) // ["api", ...]
    const [, section, rest] = parts

    if (section === "data" && rest) {
      const rows = table(rest)
      const keyField = KEY_FIELD[rest] ?? "id"
      if (method === "GET") return json({ data: rows.map((r) => ({ ...r })) })
      const payload = parseBody(body)
      if (method === "POST") {
        const incoming = Array.isArray(payload.rows) ? (payload.rows as Row[]) : []
        for (const row of incoming) {
          if (!row || typeof row !== "object") continue
          const index = rows.findIndex((r) => r[keyField] === row[keyField])
          if (index >= 0) rows[index] = { ...rows[index], ...row }
          else rows.push({ ...row })
        }
        return json({ ok: true })
      }
      if (method === "DELETE") {
        if (Array.isArray(payload.ids)) {
          const ids = new Set(payload.ids as unknown[])
          db.tables[rest] = rows.filter((r) => !ids.has(r[keyField]))
        } else if (typeof payload.column === "string") {
          db.tables[rest] = rows.filter((r) => r[payload.column as string] !== payload.value)
        }
        return json({ ok: true })
      }
      return blocked()
    }

    if (section === "settings" && rest) {
      const key = decodeURIComponent(rest)
      if (method === "GET") return json({ value: db.settings[key] ?? null })
      const payload = parseBody(body)
      if (typeof payload.value === "string") db.settings[key] = payload.value
      return json({ ok: true })
    }

    if (section === "auth" && rest === "me") return json({ mode: "demo", userId: "demo", email: null, isAdmin: false })
    if (section === "fx") return json({ USD: 0.92, CHF: 1.07 })
    if (section === "errors") return new Response(null, { status: 204 })
    if (section === "tokens" && method === "GET") return json({ tokens: [] })
    if (section === "asset-search") return json({ results: [] })
    if (section === "asset") return json({ asset: null })

    if (section === "quote") {
      const symbols = (url.searchParams.get("symbols") ?? "").split(",").map((s) => s.trim()).filter(Boolean)
      const quotes: Record<string, unknown> = {}
      for (const s of symbols) {
        const q = DEMO_QUOTES[s]
        if (q) quotes[s] = { price: q.price, currency: "EUR", name: q.name, time: Math.floor(now().getTime() / 1000), changePct: q.changePct }
      }
      return json({ quotes })
    }

    if (section === "history") {
      const symbols = (url.searchParams.get("symbols") ?? "").split(",").map((s) => s.trim()).filter(Boolean)
      const history: Record<string, unknown> = {}
      for (const s of symbols) history[s] = demoHistory(s, now().getTime())
      return json({ history })
    }

    // Comentarios, claves del Atajo, copias, logos, admin, sesión…: nada de
    // eso existe en la demo.
    return blocked()
  }

  return { db, handle }
}
