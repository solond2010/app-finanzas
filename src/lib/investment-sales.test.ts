import { describe, expect, it } from "vitest"
import { parseSales, salesHistory, type SaleRecord } from "./investment-sales"
import type { Account, Transaction } from "./store"

const acc = { id: "a1", currency: "EUR" } as Account
const tx = (p: Partial<Transaction>): Transaction => ({ id: "t", cuenta_id: "a1", monto: 10, fecha: "2026-03-01", tipo: "ingreso", categoria: "Inversiones", es_necesidad: false, descripcion: "Venta Apple", tags: ["inversion"], ...p })

describe("historial de ventas", () => {
  it("combina ventas guardadas y antiguas sin duplicar", () => {
    const sales: SaleRecord[] = [{ id: "s1", positionId: "p", name: "Apple", date: "2026-05-02", units: 2, received: 300, gain: 50, txId: "t1" }]
    const { rows, realizedYear } = salesHistory(sales, [tx({ id: "t1", monto: 50 }), tx({ id: "t2", monto: 20, tipo: "gasto", fecha: "2026-01-10", descripcion: "Venta Nike" }), tx({ id: "t3", fecha: "2025-12-01", monto: 99 }), tx({ id: "t4", descripcion: "Nómina", tags: [] })], [acc], "2026")
    expect(rows.map((r) => r.id)).toEqual(["s1", "tx:t2", "tx:t3"])
    expect(rows[1]).toMatchObject({ name: "Nike", gain: -20, legacy: true, units: null })
    expect(realizedYear).toBe(30)
  })
  it("ignora datos corruptos", () => {
    expect(parseSales("nope")).toEqual([])
    expect(parseSales('[{"id":"x"}]')).toEqual([])
  })
})

import { fullySoldPositionIds } from "./investment-sales"

describe("fullySoldPositionIds", () => {
  it("marca como cerrada una posición cuyas ventas cubren todas las uds", () => {
    expect(fullySoldPositionIds(
      [{ id: "iren", units: 15.7 }],
      [{ positionId: "iren", units: 15.7 }],
    )).toEqual(["iren"])
  })
  it("no cierra venta parcial", () => {
    expect(fullySoldPositionIds(
      [{ id: "iren", units: 15.7 }],
      [{ positionId: "iren", units: 5 }],
    )).toEqual([])
  })
  it("suma varias ventas parciales hasta cerrar", () => {
    expect(fullySoldPositionIds(
      [{ id: "x", units: 10 }],
      [{ positionId: "x", units: 4 }, { positionId: "x", units: 6 }],
    )).toEqual(["x"])
  })
})
