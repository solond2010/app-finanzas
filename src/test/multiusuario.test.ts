import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFakeDb, type FakeDb } from "./fake-supabase"

// Dos usuarios con datos que se "pisan" a propósito (mismos ids) para
// demostrar que cada uno solo ve y toca lo suyo.
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

const state = vi.hoisted(() => ({ db: null as unknown as FakeDb, user: null as string | null }))

vi.mock("@supabase/supabase-js", () => ({ createClient: () => new Proxy({}, { get: (_t, k) => (state.db as unknown as Record<string | symbol, unknown>)[k] }) }))
vi.mock("@/lib/server/request-context", () => ({
  getDataContext: async () => (state.user ? { db: state.db, userId: state.user, email: null } : null),
  unauthorizedResponse: () => new Response(JSON.stringify({ error: "No has iniciado sesión" }), { status: 401 }),
}))

process.env.SUPABASE_URL = "http://localhost:54321"
process.env.SUPABASE_ANON_KEY = "test-anon"
process.env.SHORTCUTS_SECRET = "legacy-secret-for-tests-only"

const dataRoute = await import("@/app/api/data/[table]/route")
const settingsRoute = await import("@/app/api/settings/[key]/route")
const shortcutAccounts = await import("@/app/api/shortcuts/accounts/route")
const shortcutMovement = await import("@/app/api/shortcuts/movement/route")
const shortcutCategories = await import("@/app/api/shortcuts/categories/route")
const backupRoute = await import("@/app/api/backup/route")
const tokensRoute = await import("@/app/api/tokens/route")
const { LEGACY_USER_ID } = await import("@/lib/auth-mode")

const tableParams = (table: string) => ({ params: Promise.resolve({ table }) })
const keyParams = (key: string) => ({ params: Promise.resolve({ key }) })
const req = (url: string, init?: RequestInit) => new Request(`http://test${url}`, init)
const jsonReq = (url: string, method: string, body: unknown, headers: Record<string, string> = {}) =>
  req(url, { method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) })

beforeEach(() => {
  state.user = null
  state.db = createFakeDb({
    accounts: [
      { id: "acc_principal", nombre: "Cuenta de A", tipo: "efectivo", banco: "", saldo: 100, currency: "EUR", user_id: A },
      { id: "acc_principal", nombre: "Cuenta de B", tipo: "efectivo", banco: "", saldo: 999, currency: "EUR", user_id: B },
      { id: "acc_b_solo", nombre: "Solo B", tipo: "ahorro", banco: "", saldo: 5, currency: "EUR", user_id: B },
    ],
    transactions: [
      { id: "t1", cuenta_id: "acc_principal", monto: 10, user_id: A },
      { id: "t1", cuenta_id: "acc_principal", monto: 77, user_id: B },
    ],
    categories: [
      { id: "c1", name: "Comida", kind: "gasto", user_id: A },
      { id: "c2", name: "Secreta de B", kind: "gasto", user_id: B },
    ],
    settings: [
      { key: "income-target", value: "1000", user_id: A },
      { key: "income-target", value: "5000", user_id: B },
    ],
    api_tokens: [],
  })
})

describe("/api/data aísla por usuario", () => {
  it("sin sesión → 401", async () => {
    const res = await dataRoute.GET(req("/api/data/accounts?fields=*"), tableParams("accounts"))
    expect(res.status).toBe(401)
  })

  it("A solo ve sus cuentas aunque B tenga el mismo id", async () => {
    state.user = A
    const res = await dataRoute.GET(req("/api/data/accounts?fields=*"), tableParams("accounts"))
    const body = await res.json()
    expect(body.data.map((r: { nombre: string }) => r.nombre)).toEqual(["Cuenta de A"])
  })

  it("A no puede escribir a nombre de B (user_id lo pone el servidor)", async () => {
    state.user = A
    const res = await dataRoute.POST(jsonReq("/api/data/accounts", "POST", { rows: [{ id: "acc_principal", nombre: "hackeada", saldo: 0, user_id: B }] }), tableParams("accounts"))
    expect(res.status).toBe(200)
    const bRow = state.db.tables.accounts.find((r) => r.user_id === B && r.id === "acc_principal")
    expect(bRow?.nombre).toBe("Cuenta de B")
    const aRow = state.db.tables.accounts.find((r) => r.user_id === A && r.id === "acc_principal")
    expect(aRow?.nombre).toBe("hackeada")
  })

  it("A no puede borrar filas de B aunque conozca el id", async () => {
    state.user = A
    await dataRoute.DELETE(jsonReq("/api/data/transactions", "DELETE", { ids: ["t1"] }), tableParams("transactions"))
    expect(state.db.tables.transactions.map((r) => r.user_id)).toEqual([B])
    await dataRoute.DELETE(jsonReq("/api/data/accounts", "DELETE", { column: "id", value: "acc_b_solo" }), tableParams("accounts"))
    expect(state.db.tables.accounts.some((r) => r.id === "acc_b_solo")).toBe(true)
  })
})

describe("/api/settings aísla por usuario", () => {
  it("cada uno lee y guarda su propio ajuste con la misma clave", async () => {
    state.user = B
    expect(await (await settingsRoute.GET(req("/api/settings/income-target"), keyParams("income-target"))).json()).toEqual({ value: "5000" })
    state.user = A
    await settingsRoute.POST(jsonReq("/api/settings/income-target", "POST", { value: "1200" }), keyParams("income-target"))
    expect(state.db.tables.settings.find((r) => r.user_id === B)?.value).toBe("5000")
    expect(state.db.tables.settings.find((r) => r.user_id === A)?.value).toBe("1200")
  })
})

describe("Atajos: claves por usuario", () => {
  it("sin clave o con clave falsa → 401", async () => {
    expect((await shortcutAccounts.GET(req("/api/shortcuts/accounts"))).status).toBe(401)
    expect((await shortcutAccounts.GET(req("/api/shortcuts/accounts", { headers: { "x-shortcuts-secret": "fz_" + "x".repeat(40) } }))).status).toBe(401)
  })

  it("una clave creada por B solo da acceso a los datos de B, y revocada deja de valer", async () => {
    state.user = B
    const created = await (await tokensRoute.POST(jsonReq("/api/tokens", "POST", { name: "iPhone B" }))).json()
    expect(created.token).toMatch(/^fz_/)
    // En la tabla solo queda el hash, nunca la clave.
    expect(JSON.stringify(state.db.tables.api_tokens)).not.toContain(created.token)

    state.user = null
    const headers = { "x-shortcuts-secret": created.token }
    const list = await (await shortcutAccounts.GET(req("/api/shortcuts/accounts", { headers }))).json()
    expect(list.accounts.map((a: { id: string }) => a.id).sort()).toEqual(["acc_b_solo", "acc_principal"])
    expect(JSON.stringify(list)).not.toContain("Cuenta de A")

    const cats = await (await shortcutCategories.GET(req("/api/shortcuts/categories", { headers }))).json()
    expect(cats.categories).toEqual(["Secreta de B"])

    // B no puede apuntar un gasto en una cuenta que solo existe para A.
    state.db.tables.accounts.push({ id: "acc_solo_a", nombre: "Solo A", saldo: 1, currency: "EUR", user_id: A })
    const bad = await shortcutMovement.POST(jsonReq("/api/shortcuts/movement", "POST", { tipo: "gasto", monto: "5", cuenta_id: "acc_solo_a" }, headers))
    expect(bad.status).toBe(400)
    const good = await shortcutMovement.POST(jsonReq("/api/shortcuts/movement", "POST", { tipo: "gasto", monto: "5", cuenta_id: "acc_principal", descripcion: "café" }, headers))
    expect(good.status).toBe(200)
    expect(state.db.tables.accounts.find((r) => r.user_id === B && r.id === "acc_principal")?.saldo).toBe(994)
    expect(state.db.tables.accounts.find((r) => r.user_id === A && r.id === "acc_principal")?.saldo).toBe(100)
    expect(state.db.tables.transactions.filter((r) => r.user_id === B)).toHaveLength(2)

    state.user = B
    await tokensRoute.DELETE(jsonReq("/api/tokens", "DELETE", { id: created.item.id }))
    state.user = null
    expect((await shortcutAccounts.GET(req("/api/shortcuts/accounts", { headers }))).status).toBe(401)
  })

  it("A no puede revocar la clave de B", async () => {
    state.user = B
    const created = await (await tokensRoute.POST(jsonReq("/api/tokens", "POST", {}))).json()
    state.user = A
    await tokensRoute.DELETE(jsonReq("/api/tokens", "DELETE", { id: created.item.id }))
    expect(state.db.tables.api_tokens[0].revoked_at ?? null).toBeNull()
    const listA = await (await tokensRoute.GET()).json()
    expect(listA.tokens).toEqual([])
  })

  it("el SHORTCUTS_SECRET antiguo sigue funcionando y apunta al dueño histórico", async () => {
    state.db.tables.accounts.push({ id: "acc_moha", nombre: "Moha", tipo: "efectivo", banco: "", currency: "EUR", saldo: 1, user_id: LEGACY_USER_ID })
    const list = await (await shortcutAccounts.GET(req("/api/shortcuts/accounts", { headers: { "x-shortcuts-secret": "legacy-secret-for-tests-only" } }))).json()
    expect(list.accounts.map((a: { id: string }) => a.id)).toEqual(["acc_moha"])
  })

  it("la copia de seguridad solo incluye los datos del dueño de la clave", async () => {
    state.db.tables.accounts.push({ id: "acc_moha", nombre: "Moha", saldo: 1, user_id: LEGACY_USER_ID })
    for (const t of ["sinking_funds", "budgets", "watchlist", "investments", "investment_contributions"]) state.db.tables[t] ??= []
    const res = await backupRoute.GET(req("/api/backup", { headers: { "x-shortcuts-secret": "legacy-secret-for-tests-only" } }))
    const body = await res.json()
    expect(body.tables.accounts.map((r: { id: string }) => r.id)).toEqual(["acc_moha"])
    expect(body.tables.transactions).toEqual([])
  })
})
