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
