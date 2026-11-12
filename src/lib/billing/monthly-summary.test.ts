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

  it("un traspaso o una compra de inversión no infla los gastos ni el pico de la gráfica", () => {
    const txsWithTransfer = [
      { fecha: "2026-09-10", monto: 2000, tipo: "ingreso", categoria: "Salario", id: "s9", cuenta_id: "cash" },
      { fecha: "2026-09-12", monto: 1041.2, tipo: "gasto", categoria: "Supermercado", id: "g9", cuenta_id: "cash" },
      { fecha: "2026-10-08", monto: 2284.79, tipo: "ingreso", categoria: "Salario", id: "s10", cuenta_id: "cash" },
      { fecha: "2026-10-15", monto: 1041.2, tipo: "gasto", categoria: "Supermercado", id: "g10", cuenta_id: "cash" },
      // Traspaso a inversión (las dos patas): antes se sumaba como gasto y
      // dejaba «Gastos del mes» en 17.115,11 €, con un pico falso en la gráfica.
      { fecha: "2026-10-20", monto: 16073.91, tipo: "gasto", categoria: "Transferencia", id: "xf_out", cuenta_id: "cash", tags: ["traspaso", "traspaso:inv-oct"] },
      { fecha: "2026-10-20", monto: 16073.91, tipo: "ingreso", categoria: "Transferencia", id: "xf_in", cuenta_id: "inv", tags: ["traspaso", "traspaso:inv-oct"] },
    ]
    const s = buildMonthlySummary({
      transactions: txsWithTransfer,
      netWorthNow: 6193.57,
      today: "2026-11-11",
    })
    expect(s.label).toBe("Octubre 2026")
    expect(s.expenses).toBe(1041.2)
    expect(s.prevExpenses).toBe(1041.2)
    expect(s.expensesDelta).toBe(0)
    expect(s.income).toBe(2284.79)
    expect(s.savings).toBe(1243.59)
    expect(s.expenseHistory.at(-1)).toBe(1041.2)
    expect(Math.max(...s.expenseHistory)).toBe(1041.2)
  })
})
