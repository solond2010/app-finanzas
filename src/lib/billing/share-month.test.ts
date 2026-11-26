import { describe, expect, it } from "vitest"
import { buildMonthlySummary } from "./monthly-summary"
import {
  buildShareMonth,
  exampleShareMonthView,
  formatDeltaPct,
  isBlockedShareName,
  rawProfileName,
  shareDisplayName,
  shareMonthFileName,
  shareMonthView,
  shareSourceLegend,
} from "./share-month"

const txs = [
  { fecha: "2026-09-10", monto: 2000, tipo: "ingreso", categoria: "Salario" },
  { fecha: "2026-09-12", monto: 900, tipo: "gasto", categoria: "Supermercado" },
  { fecha: "2026-10-08", monto: 1800, tipo: "ingreso", categoria: "Salario" },
  { fecha: "2026-10-09", monto: 400, tipo: "ingreso", categoria: "Freelance" },
  { fecha: "2026-10-15", monto: 500, tipo: "gasto", categoria: "Vivienda" },
  { fecha: "2026-10-16", monto: 280, tipo: "gasto", categoria: "Supermercado" },
  { fecha: "2026-10-01", monto: 10000, tipo: "ingreso", categoria: "Saldo inicial" },
  { fecha: "2026-10-20", monto: 1600, tipo: "gasto", categoria: "Transferencia", id: "xf_out", cuenta_id: "cash", tags: ["traspaso", "traspaso:inv-oct"] },
  { fecha: "2026-10-20", monto: 1600, tipo: "ingreso", categoria: "Transferencia", id: "xf_in", cuenta_id: "inv", tags: ["traspaso", "traspaso:inv-oct"] },
  { fecha: "2026-11-02", monto: 50, tipo: "gasto", categoria: "Ocio" },
]

describe("nombre en la tarjeta compartida", () => {
  it("usa el nombre del perfil y rechaza el de Moha o marcas ajenas", () => {
    expect(shareDisplayName({ name: "Lara Gil" })).toBe("Lara Gil")
    expect(shareDisplayName({ name: "  Lara   Gil  " })).toBe("Lara Gil")
    expect(shareDisplayName({ name: "Moha" })).toBeNull()
    expect(shareDisplayName({ name: "Mohamed" })).toBeNull()
    expect(shareDisplayName({ name: "Mohammed Ali" })).toBeNull()
    expect(shareDisplayName({ name: "TigreAprende" })).toBeNull()
    expect(isBlockedShareName("tigre aprende")).toBe(true)
    expect(shareDisplayName({ name: "", email: "lara@example.com" })).toBeNull()
    expect(rawProfileName({ full_name: "Lara Gil", name: "otra" })).toBe("Lara Gil")
  })
})

describe("cifras de compartir mi mes", () => {
  it("cuadran con el resumen mensual y excluyen traspasos y saldo inicial", () => {
    const input = { transactions: txs, netWorthNow: 100, today: "2026-11-11" }
    const summary = buildMonthlySummary(input)
    const card = buildShareMonth({ ...input, name: "Lara Gil" })
    expect(card.label).toBe("Octubre 2026")
    expect(card.displayName).toBe("Lara Gil")
    expect(card.income).toBe(summary.income)
    expect(card.expenses).toBe(summary.expenses)
    expect(card.savings).toBe(summary.savings)
    expect(card.income).toBe(2200)
    expect(card.expenses).toBe(780)
    expect(card.savings).toBe(1420)
    expect(card.prevIncome).toBe(2000)
    expect(card.incomeDelta).toBe(200)
    expect(card.incomeDeltaPct).toBe(10)
    expect(card.incomeSources).toEqual([
      { name: "Salario", amount: 1800, pct: 81.8 },
      { name: "Freelance", amount: 400, pct: 18.2 },
    ])
    expect(card.incomeSources.reduce((s, row) => s + row.amount, 0)).toBe(card.income)
    expect(card.topExpense).toEqual({ name: "Vivienda", amount: 500, pct: 64.1 })
    expect(card.savingsRate).toBe(65)
    expect(card.history).toHaveLength(6)
    expect(card.history.at(-1)).toMatchObject({ key: "2026-10", income: 2200, expenses: 780, net: 1420 })
    expect(card.incomeHistory).toEqual(summary.incomeHistory)
    expect(card.expenseHistory).toEqual(summary.expenseHistory)
  })

  it("formatea la variación y el nombre del archivo", () => {
    expect(formatDeltaPct(10)).toBe("+10 %")
    expect(formatDeltaPct(7.9)).toBe("+7,9 %")
    expect(formatDeltaPct(-4)).toBe("−4 %")
    expect(formatDeltaPct(null)).toBeNull()
    expect(shareMonthFileName("Octubre 2026")).toBe("garra-mi-mes-octubre-2026.png")
  })

  it("en cada fuente muestra el importe en euros y el porcentaje", () => {
    const view = shareMonthView(buildShareMonth({ transactions: txs, netWorthNow: 100, today: "2026-11-11", name: "Lara Gil" }))
    const salario = shareSourceLegend(view.sources[0]!)
    const freelance = shareSourceLegend(view.sources[1]!)
    expect(salario).toContain("Salario")
    expect(salario).toContain("1.800,00")
    expect(salario).toContain("€")
    expect(salario).toContain("(81,8 %)")
    expect(salario.startsWith("Salario ")).toBe(true)
    expect(freelance).toContain("Freelance")
    expect(freelance).toContain("400,00")
    expect(freelance).toContain("(18,2 %)")
    expect(shareSourceLegend(view.sources[0]!)).toBe(`Salario ${view.sources[0]!.amountText} (${view.sources[0]!.pctText})`)
    expect(shareSourceLegend(exampleShareMonthView().sources[0]!)).toContain("Nómina")
    expect(shareSourceLegend(exampleShareMonthView().sources[0]!)).toContain("2.100,00")
    expect(shareSourceLegend(exampleShareMonthView().sources[0]!)).toContain("(85,7 %)")
  })

  it("si hay más de 4 fuentes agrupa el resto en Otros", () => {
    const many = [
      { fecha: "2026-10-01", monto: 1000, tipo: "ingreso", categoria: "Nómina" },
      { fecha: "2026-10-02", monto: 500, tipo: "ingreso", categoria: "Freelance" },
      { fecha: "2026-10-03", monto: 300, tipo: "ingreso", categoria: "Alquiler" },
      { fecha: "2026-10-04", monto: 200, tipo: "ingreso", categoria: "Dividendos" },
      { fecha: "2026-10-05", monto: 80, tipo: "ingreso", categoria: "Regalo" },
      { fecha: "2026-10-06", monto: 70, tipo: "ingreso", categoria: "Otros extra" },
      { fecha: "2026-10-10", monto: 100, tipo: "gasto", categoria: "Comida" },
    ]
    const card = buildShareMonth({ transactions: many, netWorthNow: 100, today: "2026-11-11" })
    expect(card.label).toBe("Octubre 2026")
    expect(card.incomeSources.map((row) => row.name)).toEqual(["Nómina", "Freelance", "Alquiler", "Dividendos", "Otros"])
    expect(card.incomeSources).toHaveLength(5)
    expect(card.incomeSources.at(-1)).toEqual({ name: "Otros", amount: 150, pct: 7 })
    expect(card.incomeSources.reduce((s, row) => s + row.amount, 0)).toBe(card.income)
  })

  it("el ejemplo usa un nombre inventado y no menciona a Moha ni TigreAprende", () => {
    const view = exampleShareMonthView()
    expect(view.displayName).toBe("Lara Gil")
    expect(view.footer).toBe("Hecho con Garra · migarra.app")
    const blob = JSON.stringify(view).toLowerCase()
    expect(blob).not.toMatch(/moha|mohamed|tigreaprende|tigre aprende/)
    const card = shareMonthView(buildShareMonth({ transactions: txs, netWorthNow: 100, today: "2026-11-11", name: "Lara Gil" }))
    expect(card.incomeText).toContain("2.200,00")
    expect(card.incomeDeltaText).toContain("200,00")
    expect(card.incomeDeltaPctText).toBe("+10 %")
  })
})
