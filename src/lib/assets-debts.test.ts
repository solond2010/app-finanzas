import { describe, expect, it } from "vitest"
import { paidPct, parseAssets, parseDebts, totals } from "./assets-debts"

describe("bienes y deudas", () => {
  it("parsea, normaliza tipos y suma", () => {
    const a = parseAssets([{ id: "a", nombre: "Piso", tipo: "vivienda", valor: "300000" }, { id: "b", nombre: "X", tipo: "raro", valor: -5 }])
    const d = parseDebts([{ id: "d", nombre: "Hipo", tipo: "hipoteca", pendiente: 150000, principal_inicial: 200000, cuota_mensual: 780 }])
    expect(a[1].tipo).toBe("otro")
    expect(a[1].valor).toBe(0)
    expect(totals(a, d)).toEqual({ bienes: 300000, deudas: 150000, cuotas: 780, neto: 150000 })
    expect(paidPct(d[0])).toBe(25)
    expect(paidPct({ pendiente: 10, principal_inicial: null })).toBeNull()
  })
})
