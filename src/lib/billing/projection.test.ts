import { describe, expect, it } from "vitest"
import { averageMonthlySavings, monthsLabel, monthsToGoal, projectNetWorth } from "./projection"

describe("proyección", () => {
  const txs = [
    { fecha: "2026-08-01", monto: 2000, tipo: "ingreso", categoria: "Salario" },
    { fecha: "2026-08-10", monto: 1500, tipo: "gasto", categoria: "Vivienda" },
    { fecha: "2026-09-01", monto: 2000, tipo: "ingreso", categoria: "Salario" },
    { fecha: "2026-09-10", monto: 1400, tipo: "gasto", categoria: "Vivienda" },
    { fecha: "2026-10-01", monto: 2000, tipo: "ingreso", categoria: "Salario" },
    { fecha: "2026-10-10", monto: 1360, tipo: "gasto", categoria: "Vivienda" },
  ]

  it("promedia el ahorro de los meses cerrados y proyecta un año", () => {
    const avg = averageMonthlySavings(txs, "2026-11-11", 3)
    expect(avg).toBe(580)
    expect(projectNetWorth(48230, avg, 12)).toBe(55190)
  })

  it("un traspaso o compra de inversión no se cuenta como gasto ni ingreso", () => {
    const withTransfer = [
      ...txs,
      { fecha: "2026-10-20", monto: 16073.91, tipo: "gasto", categoria: "Transferencia", id: "xf_out", cuenta_id: "cash", tags: ["traspaso", "traspaso:inv-oct"] },
      { fecha: "2026-10-20", monto: 16073.91, tipo: "ingreso", categoria: "Transferencia", id: "xf_in", cuenta_id: "inv", tags: ["traspaso", "traspaso:inv-oct"] },
    ]
    expect(averageMonthlySavings(withTransfer, "2026-11-11", 3)).toBe(580)
  })

  it("un mes que solo tiene un traspaso no entra en la media como ahorro 0", () => {
    const txsNoSeptember = [
      { fecha: "2026-08-01", monto: 2000, tipo: "ingreso", categoria: "Salario", id: "s8", cuenta_id: "cash" },
      { fecha: "2026-08-10", monto: 1500, tipo: "gasto", categoria: "Vivienda", id: "g8", cuenta_id: "cash" },
      { fecha: "2026-10-01", monto: 2000, tipo: "ingreso", categoria: "Salario", id: "s10", cuenta_id: "cash" },
      { fecha: "2026-10-10", monto: 1360, tipo: "gasto", categoria: "Vivienda", id: "g10", cuenta_id: "cash" },
      { fecha: "2026-09-20", monto: 16073.91, tipo: "gasto", categoria: "Transferencia", id: "xf_out", cuenta_id: "cash", tags: ["traspaso", "traspaso:inv-sep"] },
      { fecha: "2026-09-20", monto: 16073.91, tipo: "ingreso", categoria: "Transferencia", id: "xf_in", cuenta_id: "inv", tags: ["traspaso", "traspaso:inv-sep"] },
    ]
    // Octubre 640 + agosto 500; septiembre (solo traspaso) se ignora. Media 570.
    // Sin el filtro, septiembre contaría como 0 € y la media bajaría a 380.
    expect(averageMonthlySavings(txsNoSeptember, "2026-11-11", 3)).toBe(570)
  })

  it("estima los meses hasta una meta y no divide por cero", () => {
    expect(monthsToGoal(1800, 600)).toBe(3)
    expect(monthsToGoal(0, 600)).toBe(0)
    expect(monthsToGoal(100, 0)).toBeNull()
    expect(monthsLabel(1)).toBe("un mes")
    expect(monthsLabel(3)).toBe("unos 3 meses")
    expect(monthsLabel(null)).toBeNull()
  })
})
