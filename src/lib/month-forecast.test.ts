import { describe, expect, it } from "vitest"
import { monthEndForecast } from "./month-forecast"

describe("previsión de fin de mes", () => {
  const today = new Date(2026, 10, 10) // 10 nov, 30 días
  it("proyecta el gasto variable y resta fijos pendientes", () => {
    const tx = [
      { tipo: "ingreso" as const, monto: 2000, fecha: "2026-11-01" },
      { tipo: "gasto" as const, monto: 100, fecha: "2026-11-05" },
      { tipo: "gasto" as const, monto: 700, fecha: "2026-11-01", tags: ["recurrente"] },
      { tipo: "gasto" as const, monto: 999, fecha: "2026-10-30" },
    ]
    const rec = [{ tipo: "gasto" as const, monto: 50, nextDate: "2026-11-20" }, { tipo: "gasto" as const, monto: 80, nextDate: "2026-12-01" }]
    // 2000 − 800 − (100/10×30 − 100 = 200) − 50
    expect(monthEndForecast(tx, rec, today)).toBe(950)
  })
  it("suma ingresos fijos pendientes y puede ser negativa", () => {
    expect(monthEndForecast([{ tipo: "gasto", monto: 300, fecha: "2026-11-02" }], [{ tipo: "ingreso", monto: 100, nextDate: "2026-11-25" }], today)).toBe(100 - 900)
  })
  it("con menos de 3 días no hay previsión", () => {
    expect(monthEndForecast([], [], new Date(2026, 10, 2))).toBeNull()
  })

  it("un traspaso o compra de inversión no infla el gasto previsto", () => {
    const tx = [
      { tipo: "ingreso" as const, monto: 2000, fecha: "2026-11-01" },
      { tipo: "gasto" as const, monto: 100, fecha: "2026-11-05" },
      { tipo: "gasto" as const, monto: 700, fecha: "2026-11-01", tags: ["recurrente"] },
      { tipo: "gasto" as const, monto: 16073.91, fecha: "2026-11-08", id: "xf_out", cuenta_id: "cash", tags: ["traspaso", "traspaso:inv"] },
      { tipo: "ingreso" as const, monto: 16073.91, fecha: "2026-11-08", id: "xf_in", cuenta_id: "inv", tags: ["traspaso", "traspaso:inv"] },
    ]
    const rec = [{ tipo: "gasto" as const, monto: 50, nextDate: "2026-11-20" }]
    // Misma previsión que el caso base (950). Sin el filtro, el traspaso
    // entraría como gasto variable y dispararía la proyección.
    expect(monthEndForecast(tx, rec, today)).toBe(950)
  })
})
