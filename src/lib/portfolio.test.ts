import { describe, expect, it } from "vitest"
import { computePortfolio } from "./portfolio"
import type { Position } from "./investments"

const pos = (o: Partial<Position>): Position => ({ id: "p", kind: "fund", symbol: "X", name: "X", date: "2026-10-05", units: 10, buyPrice: 10, currency: "EUR", ...o })

describe("computePortfolio", () => {
  it("compara lo aportado con el valor actual", () => {
    const p = computePortfolio([pos({ id: "a", symbol: "A" }), pos({ id: "b", symbol: "B", kind: "crypto", units: 1, buyPrice: 50 })], { A: { price: 12, currency: "EUR" }, B: { price: 40, currency: "EUR" } }, [], new Date(2026, 10, 3))
    expect(p.invested).toBe(150)
    expect(p.value).toBe(160)
    expect(p.gain).toBe(10)
    expect(p.gainPct).toBeCloseTo(6.667, 2)
    expect(p.rows[0].id).toBe("a")
    expect(p.rows[1].gain).toBe(-10)
    expect(p.allocation.map((a) => a.assetClass)).toEqual(["fondos_indexados", "cripto"])
    expect(p.allocation[0].pct).toBeCloseTo(75, 5)
  })
  it("sin cotización usa el precio de compra (ganancia 0)", () => {
    const p = computePortfolio([pos({ kind: "custom" })], {}, [])
    expect(p.value).toBe(100)
    expect(p.gain).toBe(0)
    expect(p.rows[0].hasQuote).toBe(false)
  })
  it("aportaciones por mes: usa los aportes o, si no hay, la compra inicial; y el plan mensual", () => {
    const p = computePortfolio(
      [pos({ id: "a", dca: true, dcaAmount: 100, dcaFreq: "monthly" }), pos({ id: "b", date: "2026-09-10", units: 2, buyPrice: 25 })],
      {},
      [{ id: "c1", positionId: "a", amount: 100, date: "2026-10-28" }, { id: "c2", positionId: "a", amount: 100, date: "2026-11-02" }, { id: "old", positionId: "a", amount: 999, date: "2024-01-01" }],
      new Date(2026, 10, 3),
    )
    expect(p.months).toHaveLength(12)
    expect(p.months.at(-1)).toEqual({ key: "2026-11", amount: 100 })
    expect(p.months.at(-2)).toEqual({ key: "2026-10", amount: 100 })
    expect(p.months.at(-3)).toEqual({ key: "2026-09", amount: 50 })
    expect(p.monthlyPlan).toBe(100)
  })
})

import { computeInvestments } from "./portfolio"
import type { Account } from "./store"

const acc = (o: Partial<Account>): Account => ({ id: "a1", nombre: "Broker", tipo: "inversion", banco: "", saldo: 1000, currency: "EUR", objetivo: null, limite_mensual: null, color: "#000", ...o })

describe("computeInvestments", () => {
  it("el total es la suma de saldos de las cuentas de inversión; lo no asignado es su propia porción", () => {
    const v = computeInvestments(
      [acc({ id: "a1", saldo: 1000 }), acc({ id: "a2", saldo: 500 }), acc({ id: "g", tipo: "gastos", saldo: 9999 })],
      [pos({ id: "p1", symbol: "A", accountId: "a1" }), pos({ id: "p2", symbol: "Z", accountId: "borrada" })],
      { A: { price: 30, currency: "EUR" } }, [],
    )
    expect(v.total).toBe(1500)
    expect(v.accounts.map((a) => a.id)).toEqual(["a1", "a2"])
    expect(v.accounts[0].positionsValue).toBe(300)
    expect(v.accounts[0].unassigned).toBe(700)
    expect(v.unassigned).toBe(1200)
    expect(v.assigned).toBe(300)
    expect(v.gain).toBe(200)
    expect(v.orphans.map((r) => r.id)).toEqual(["p2"])
    const sum = v.allocation.reduce((s, x) => s + x.value, 0)
    expect(sum).toBeCloseTo(1500, 2)
    expect(v.allocation[0]).toMatchObject({ key: "sin_asignar", value: 1200 })
  })
  it("si las posiciones superan el saldo, el reparto no pasa del saldo", () => {
    const v = computeInvestments([acc({ saldo: 100 })], [pos({ id: "p", symbol: "A", accountId: "a1" })], { A: { price: 20, currency: "EUR" } }, [])
    expect(v.total).toBe(100)
    expect(v.accounts[0].over).toBe(true)
    expect(v.accounts[0].unassigned).toBe(0)
    expect(v.allocation.reduce((s, x) => s + x.value, 0)).toBeCloseTo(100, 2)
  })
})
