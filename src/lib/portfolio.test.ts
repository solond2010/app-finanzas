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
  it("desfase pequeño (<50 € o <2 %) no marca aviso fuerte", () => {
    // 1030 vs 1000 → 30 € (<50) aunque sea >2 %
    const soft = computeInvestments([acc({ saldo: 1000 })], [pos({ id: "p", symbol: "A", accountId: "a1", units: 103, buyPrice: 10 })], { A: { price: 10, currency: "EUR" } }, [])
    expect(soft.accounts[0].over).toBe(false)
    // 10100 vs 10000 → 100 € pero solo 1 %
    const softPct = computeInvestments([acc({ saldo: 10000 })], [pos({ id: "p", symbol: "A", accountId: "a1", units: 1010, buyPrice: 10 })], { A: { price: 10, currency: "EUR" } }, [])
    expect(softPct.accounts[0].over).toBe(false)
  })
})

import { computeSale } from "./portfolio"

describe("computeSale", () => {
  const p = { units: 10, buyPrice: 20, currency: "EUR" }
  it("venta total con ganancia: la ganancia es venta − coste", () => {
    expect(computeSale(p, 10, 260)).toEqual({ unitsSold: 10, remainingUnits: 0, full: true, costBasis: 200, gain: 60 })
  })
  it("venta parcial con pérdida", () => {
    expect(computeSale(p, 4, 70)).toEqual({ unitsSold: 4, remainingUnits: 6, full: false, costBasis: 80, gain: -10 })
  })
  it("rechaza vender más de lo que hay o importes no válidos", () => {
    expect(computeSale(p, 11, 100)).toBeNull()
    expect(computeSale(p, 0, 100)).toBeNull()
    expect(computeSale(p, 5, -1)).toBeNull()
  })
})

import { saleTotalFromPrice, unitPriceFromTotal } from "./portfolio"

describe("precio por unidad ↔ total de la venta", () => {
  it("unidades × precio = total, y al revés", () => {
    expect(saleTotalFromPrice(118.6, 15.02, "EUR")).toBe(1781.37)
    expect(unitPriceFromTotal(1900, 118.6, "EUR")).toBeCloseTo(16.0202, 4)
    expect(saleTotalFromPrice(0, 10, "EUR")).toBeNull()
    expect(unitPriceFromTotal(100, 0, "EUR")).toBeNull()
  })
  it("el total calculado da la ganancia correcta", () => {
    const total = saleTotalFromPrice(4, 17.5, "EUR")!
    expect(computeSale({ units: 10, buyPrice: 20, currency: "EUR" }, 4, total)?.gain).toBe(-10)
  })
})

import { freshnessLabel, looksLikeCode } from "./portfolio"

describe("nombres legibles y frescura del precio", () => {
  it("detecta códigos frente a nombres", () => {
    expect(looksLikeCode("0P00012I6A.F", "0P00012I6A.F")).toBe(true)
    expect(looksLikeCode("IE00B4L5Y983", "IWDA.AS")).toBe(true)
    expect(looksLikeCode("Fondo indexado MSCI World", "X")).toBe(false)
    expect(looksLikeCode("Apple", "AAPL")).toBe(false)
  })
  it("usa el nombre de la cotización si el guardado es un código", () => {
    const p = computePortfolio([pos({ name: "0P00012I6A.F", symbol: "0P00012I6A.F" })], { "0P00012I6A.F": { price: 11, currency: "EUR", name: "Vanguard Global Stock Index", time: 1 } }, [])
    expect(p.rows[0].name).toBe("Vanguard Global Stock Index")
    expect(p.rows[0].code).toBe("0P00012I6A.F")
  })
  it("etiqueta de frescura", () => {
    const now = 1_000_000_000_000
    expect(freshnessLabel(now / 1000 - 300, now)).toBe("hace 5 min")
    expect(freshnessLabel(now / 1000 - 3 * 3600, now)).toBe("hace 3 h")
    expect(freshnessLabel(now / 1000 - 2 * 86400, now)).toBe("hace 2 días")
    expect(freshnessLabel(null, now)).toBeNull()
  })
})

import { dcaAnchorForDay, dcaPendingDates } from "./investments"

describe("aporte mensual por día", () => {
  it("ancla al último día que tocó y no aplica hacia atrás", () => {
    const today = new Date(2026, 10, 3) // 3 nov
    expect(dcaAnchorForDay(5, today)).toBe("2026-10-05")
    expect(dcaAnchorForDay(3, today)).toBe("2026-11-03")
    expect(dcaAnchorForDay(31, today)).toBe("2026-10-28")
    expect(dcaPendingDates({ amount: 100, freq: "monthly", last: dcaAnchorForDay(5, today) }, today)).toHaveLength(0)
    expect(dcaPendingDates({ amount: 100, freq: "monthly", last: "2026-10-05" }, new Date(2026, 10, 5))).toHaveLength(1)
  })
})

import { dedupeContributions, dcaContributionId, fresherDcaPosition, orderParentsFirst, replaceInQueue, type PendingInvestmentWrite } from "./investments"

describe("sincronización segura", () => {
  const w = (id: string, table: PendingInvestmentWrite["table"], key: string, row?: Record<string, unknown>): PendingInvestmentWrite => ({ id, table, keyField: "id", key, operation: "upsert", row })
  it("sube la posición antes que su aporte", () => {
    const q = [w("1", "investment_contributions", "c1", { position_id: "P" }), w("2", "investments", "X"), w("3", "investments", "P")]
    expect(orderParentsFirst(q).map((x) => x.id)).toEqual(["3", "1", "2"])
  })
  it("editar una fila en cola conserva su sitio", () => {
    const q = [w("1", "investments", "P"), w("2", "investment_contributions", "c1", { position_id: "P" })]
    expect(replaceInQueue(q, w("9", "investments", "P")).map((x) => x.id)).toEqual(["9", "2"])
  })
  it("un mes automático nunca cuenta dos veces", () => {
    const id = dcaContributionId("P", "2026-03-05")
    const list = [{ id, positionId: "P", amount: 100, date: "2026-03-05" }, { id, positionId: "P", amount: 100, date: "2026-03-05" }, { id: "x", positionId: "P", amount: 5, date: "2026-01-01" }]
    expect(dedupeContributions(list)).toHaveLength(2)
  })
  it("usa la versión de la nube si ya aplicó más meses", () => {
    const base = { id: "P", kind: "stock", symbol: "S", name: "S", date: "2026-01-05", units: 1, buyPrice: 1, currency: "EUR", dca: true, dcaAmount: 10, dcaFreq: "monthly" } as const
    const local = { ...base, dcaLast: "2026-02-05" }, remote = { ...base, units: 2, dcaLast: "2026-03-05" }
    expect(fresherDcaPosition(local, remote)).toBe(remote)
    expect(fresherDcaPosition(remote, local)).toBe(remote)
  })
})
