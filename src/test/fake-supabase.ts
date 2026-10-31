// Base de datos falsa en memoria con la misma forma de consulta que
// supabase-js (from().select().eq()...). NO aplica RLS: así los tests
// demuestran que las rutas filtran por user_id por sí mismas (segunda
// barrera). Las políticas RLS se prueban aparte contra Postgres real.

type Row = Record<string, unknown>
type Filter = (row: Row) => boolean

const PKS: Record<string, string[]> = {
  settings: ["user_id", "key"],
  watchlist: ["user_id", "symbol"],
}

export function createFakeDb(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {}
  for (const [k, v] of Object.entries(initial)) tables[k] = v.map((r) => ({ ...r }))

  function from(table: string) {
    tables[table] ??= []
    const filters: Filter[] = []
    let op: "select" | "upsert" | "insert" | "update" | "delete" = "select"
    let payload: Row[] = []
    let patch: Row = {}
    let mode: "many" | "single" | "maybe" = "many"
    let head = false
    let wantCount = false
    let returning = false
    let range: [number, number] | null = null

    const pk = PKS[table] ?? ["user_id", "id"]
    const sameKey = (a: Row, b: Row) => pk.every((k) => a[k] === b[k])

    const builder = {
      select(_fields?: string, opts?: { count?: string; head?: boolean }) {
        if (op === "select") op = "select"
        else returning = true
        head = !!opts?.head
        wantCount = !!opts?.count
        return builder
      },
      eq(col: string, val: unknown) { filters.push((r) => r[col] === val); return builder },
      in(col: string, vals: unknown[]) { filters.push((r) => vals.includes(r[col])); return builder },
      is(col: string, val: unknown) { filters.push((r) => (r[col] ?? null) === val); return builder },
      order() { return builder },
      range(a: number, b: number) { range = [a, b]; return builder },
      maybeSingle() { mode = "maybe"; return builder },
      single() { mode = "single"; return builder },
      upsert(rows: Row | Row[]) { op = "upsert"; payload = Array.isArray(rows) ? rows : [rows]; return builder },
      insert(rows: Row | Row[]) { op = "insert"; payload = Array.isArray(rows) ? rows : [rows]; return builder },
      update(p: Row) { op = "update"; patch = p; return builder },
      delete() { op = "delete"; return builder },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve(run()).then(resolve, reject)
      },
    }

    function run() {
      const rows = tables[table]
      const match = (r: Row) => filters.every((f) => f(r))
      if (op === "upsert" || op === "insert") {
        const inserted: Row[] = []
        for (const row of payload) {
          const existing = rows.find((r) => sameKey(r, row))
          if (existing && op === "insert") return { data: null, error: { message: "duplicate key" } }
          if (existing) Object.assign(existing, row)
          else rows.push({ id: row.id ?? crypto.randomUUID(), created_at: new Date().toISOString(), ...row })
          inserted.push(existing ?? rows[rows.length - 1])
        }
        if (returning) return { data: mode === "many" ? inserted : inserted[0], error: null }
        return { data: null, error: null }
      }
      if (op === "update") {
        rows.filter(match).forEach((r) => Object.assign(r, patch))
        return { data: null, error: null }
      }
      if (op === "delete") {
        tables[table] = rows.filter((r) => !match(r))
        return { data: null, error: null }
      }
      let out = rows.filter(match)
      const count = out.length
      if (range) out = out.slice(range[0], range[1] + 1)
      if (head) return { data: null, count, error: null }
      if (mode === "single") return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { message: "not single" } }
      if (mode === "maybe") return { data: out[0] ?? null, error: null }
      return { data: out, count: wantCount ? count : null, error: null }
    }

    return builder
  }

  return { from, tables, storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) }) } }
}
export type FakeDb = ReturnType<typeof createFakeDb>
