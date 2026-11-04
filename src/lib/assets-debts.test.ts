import { describe, expect, it } from "vitest"
import { debtRecurring, paidPct, parseAssets, parseDebts, totals } from "./assets-debts"

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
})
