import { describe, expect, it } from "vitest"
import { applyDebtPayments, debtRecurring, paidPct, parseAssets, parseDebts, totals } from "./assets-debts"

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

  it("la cuota con gasto fijo genera un único vencimiento mensual", () => {
    const [d] = parseDebts([{ id: "h", nombre: "Piso", tipo: "hipoteca", pendiente: 1000, cuota_mensual: 760, cuota_gasto_fijo: true, cuota_dia: 1, cuota_cuenta_id: "c" }])
    const today = new Date(2026, 10, 4)
    const none = debtRecurring([d], [], today)
    expect(none).toHaveLength(1)
    expect(none[0]).toMatchObject({ nextDate: "2026-12-01", monto: 760, descripcion: "Cuota hipoteca – Piso", categoria: "Hipoteca" })
    const paid = debtRecurring([d], [{ id: "t", cuenta_id: "c", monto: 760, fecha: "2026-11-01", tipo: "gasto", categoria: "Hipoteca", es_necesidad: true, descripcion: "", tags: ["deuda:h"] } as never], today)
    expect(paid[0].nextDate).toBe("2026-12-01")
    expect(debtRecurring([{ ...d, cuota_gasto_fijo: false }], [], today)).toHaveLength(0)
  })
  it("descuenta las cuotas pagadas después de guardar el pendiente, sin duplicar", () => {
    const [d] = parseDebts([{ id: "h", nombre: "Piso", tipo: "hipoteca", pendiente: 1000, principal_inicial: 2000, pendiente_at: "2026-11-01T10:00:00Z" }])
    const tx = (id: string, created_at: string) => ({ id, cuenta_id: "c", monto: 100, fecha: created_at.slice(0, 10), tipo: "gasto" as const, categoria: "Hipoteca", es_necesidad: true, descripcion: "", tags: ["deuda:h"], created_at })
    expect(applyDebtPayments([d], [tx("old", "2026-10-30T10:00:00Z")])[0].pendiente).toBe(1000)
    const after = applyDebtPayments([d], [tx("a", "2026-11-02T10:00:00Z"), tx("b", "2026-12-01T10:00:00Z")])[0]
    expect(after.pendiente).toBe(800)
    expect(paidPct(after)).toBe(60)
    expect(applyDebtPayments([d], [])[0].pendiente).toBe(1000)
  })
})

import { assetDebtNetAt, assetValueAt, parseAssetValues } from "./assets-debts"
describe("historial de bienes", () => {
  it("usa el valor vigente en cada fecha y no cuenta antes del primero", () => {
    const [a] = parseAssets([{ id: "p", nombre: "Piso", tipo: "vivienda", valor: 240000 }])
    const vals = parseAssetValues([{ id: "2", asset_id: "p", valor: 240000, fecha: "2026-09-01" }, { id: "1", asset_id: "p", valor: 230000, fecha: "2026-06-15" }])
    expect(assetValueAt(a, vals, "2026-06-01")).toBe(0)
    expect(assetValueAt(a, vals, "2026-07-31")).toBe(230000)
    expect(assetValueAt(a, vals, "2026-10-01")).toBe(240000)
    const [d] = parseDebts([{ id: "h", nombre: "Hipo", tipo: "hipoteca", pendiente: 100000, asset_id: "p" }])
    const pay = { id: "t", cuenta_id: "c", monto: 500, fecha: "2026-10-01", tipo: "gasto" as const, categoria: "", es_necesidad: true, descripcion: "", tags: ["deuda:h"] }
    expect(assetDebtNetAt("2026-05", [a], vals, [d], [pay], "2026-11-04")).toBe(0)
    expect(assetDebtNetAt("2026-09", [a], vals, [d], [pay], "2026-11-04")).toBe(240000 - 100500)
    expect(assetDebtNetAt("2026-11", [a], vals, [d], [pay], "2026-11-04")).toBe(140000)
  })
})
