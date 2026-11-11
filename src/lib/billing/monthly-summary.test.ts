import { describe, expect, it } from "vitest"
import { buildMonthlySummary } from "./monthly-summary"

describe("resumen mensual", () => {
  const txs = [
    { fecha: "2026-09-10", monto: 2000, tipo: "ingreso", categoria: "Salario" },
    { fecha: "2026-09-12", monto: 900, tipo: "gasto", categoria: "Supermercado" },
    { fecha: "2026-10-08", monto: 2000, tipo: "ingreso", categoria: "Salario" },
    { fecha: "2026-10-15", monto: 780, tipo: "gasto", categoria: "Supermercado" },
    { fecha: "2026-10-01", monto: 10000, tipo: "ingreso", categoria: "Saldo inicial" },
    { fecha: "2026-11-02", monto: 50, tipo: "gasto", categoria: "Ocio" },
  ]

  it("usa el último mes cerrado y no cuenta el saldo inicial", () => {
    const s = buildMonthlySummary({
      transactions: txs,
      netWorthNow: 48230,
      netWorthByMonth: { "2026-09": 47000, "2026-10": 48220 },
      today: "2026-11-11",
    })
    expect(s.label).toBe("Octubre 2026")
    expect(s.income).toBe(2000)
    expect(s.expenses).toBe(780)
    expect(s.savings).toBe(1220)
    expect(s.prevExpenses).toBe(900)
    expect(s.expensesDelta).toBe(-120)
    expect(s.netWorth).toBe(48220)
    expect(s.prevNetWorth).toBe(47000)
    expect(s.netWorthDelta).toBe(1220)
    expect(s.improved).toBe(true)
  })

  it("si no hay mes cerrado, resume el mes en curso", () => {
    const s = buildMonthlySummary({
      transactions: [txs[5]!],
      netWorthNow: 100,
      today: "2026-11-11",
    })
    expect(s.label).toBe("Noviembre 2026")
    expect(s.expenses).toBe(50)
    expect(s.prevNetWorth).toBeNull()
  })
})
