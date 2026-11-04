import { describe, expect, it } from "vitest"
import { buildDemoDatabase } from "./data"
import { createDemoApi } from "./fake-api"
import { DEMO_BLOCKED_MESSAGE, hasDemoCookie, isDemoEntryPath } from "./constants"
import { hasTransferPair } from "../calculations"
import type { Transaction } from "../store"

const NOW = new Date(2026, 10, 1, 0, 30)

describe("datos de la demo", () => {
  const db = buildDemoDatabase(NOW)
  const txs = db.tables.transactions as unknown as Transaction[]

  it("tiene cuentas con color y varios meses de movimientos", () => {
    expect(db.tables.accounts.length).toBe(6)
    for (const a of db.tables.accounts) expect(a.color).toMatch(/^#[0-9A-F]{6}$/i)
    const months = new Set(txs.map((t) => t.fecha.slice(0, 7)))
    expect(months.size).toBe(8)
    expect(txs.length).toBeGreaterThan(150)
  })

  it("el saldo de cada cuenta cuadra con su histórico y nada es futuro", () => {
    for (const a of db.tables.accounts) {
      const sum = txs.filter((t) => t.cuenta_id === a.id).reduce((s, t) => s + (t.tipo === "ingreso" ? t.monto : -t.monto), 0)
      expect(Math.abs(sum - Number(a.saldo))).toBeLessThan(0.01)
      expect(Number(a.saldo)).toBeGreaterThan(0)
    }
    expect(txs.every((t) => t.fecha <= "2026-11-01")).toBe(true)
  })

  it("los traspasos van en pareja y las categorías existen", () => {
    const transfers = txs.filter((t) => t.tags.includes("traspaso"))
    expect(transfers.length).toBeGreaterThan(10)
    expect(transfers.every((t) => hasTransferPair(t, txs))).toBe(true)
    const names = new Set(db.tables.categories.map((c) => c.name))
    for (const t of txs) if (t.categoria !== "Saldo inicial") expect(names.has(t.categoria)).toBe(true)
  })

  it("es igual en cada recarga", () => {
    expect(buildDemoDatabase(NOW)).toEqual(db)
  })
})

describe("API en memoria de la demo", () => {
  const url = (path: string) => new URL(path, "https://garra.test")

  it("lee, guarda y borra solo en memoria", async () => {
    const api = createDemoApi(() => NOW)
    const before = (await (await api.handle("GET", url("/api/data/transactions"), null)).json()).data.length
    await api.handle("POST", url("/api/data/transactions"), JSON.stringify({ rows: [{ id: "nuevo", monto: 5 }] }))
    expect((await (await api.handle("GET", url("/api/data/transactions"), null)).json()).data.length).toBe(before + 1)
    await api.handle("DELETE", url("/api/data/transactions"), JSON.stringify({ ids: ["nuevo"] }))
    expect((await (await api.handle("GET", url("/api/data/transactions"), null)).json()).data.length).toBe(before)
    // Otra instancia (= recargar) vuelve a los datos de ejemplo.
    const fresh = createDemoApi(() => NOW)
    expect((await (await fresh.handle("GET", url("/api/data/transactions"), null)).json()).data.length).toBe(before)
  })

  it("no es admin y bloquea comentarios, claves, copias y logos", async () => {
    const api = createDemoApi(() => NOW)
    expect(await (await api.handle("GET", url("/api/auth/me"), null)).json()).toMatchObject({ mode: "demo", isAdmin: false })
    for (const [method, path] of [["POST", "/api/feedback"], ["POST", "/api/tokens"], ["GET", "/api/backup"], ["POST", "/api/storage/bank-logos"], ["GET", "/api/admin"], ["GET", "/api/admin/resumen"], ["POST", "/api/auth/logout"]]) {
      const res = await api.handle(method, url(path), "{}")
      expect(res.status).toBe(403)
      expect((await res.json()).error).toBe(DEMO_BLOCKED_MESSAGE)
    }
    expect((await api.handle("POST", url("/api/errors"), "{}")).status).toBe(204)
  })
})

describe("cookie de demo", () => {
  it("se reconoce en la cabecera Cookie", () => {
    expect(hasDemoCookie("a=1; garra-demo=1")).toBe(true)
    expect(hasDemoCookie("garra-demo=0")).toBe(false)
    expect(hasDemoCookie(undefined)).toBe(false)
    expect(isDemoEntryPath("/demo")).toBe(true)
    expect(isDemoEntryPath("/demo/otra")).toBe(false)
  })
})
