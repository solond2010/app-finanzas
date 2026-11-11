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

  it("estima los meses hasta una meta y no divide por cero", () => {
    expect(monthsToGoal(1800, 600)).toBe(3)
    expect(monthsToGoal(0, 600)).toBe(0)
    expect(monthsToGoal(100, 0)).toBeNull()
    expect(monthsLabel(1)).toBe("un mes")
    expect(monthsLabel(3)).toBe("unos 3 meses")
    expect(monthsLabel(null)).toBeNull()
  })
})
