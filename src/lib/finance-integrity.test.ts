import { describe, expect, it } from "vitest"
import { auditFinanceState } from "./finance-integrity"
import type { FinanceState } from "./store"
import type { Contribution, Position } from "./investments"

describe("auditFinanceState", () => {
  it("detecta referencias huérfanas, tipos inválidos y saldos que no cuadran sin mutar el estado", () => {
    const state = {
      accounts: [{ id: "a1", nombre: "Cuenta", saldo: 25 }],
      transactions: [{ id: "t1", cuenta_id: "missing", monto: 10, fecha: "2026-02-30", tipo: "otro", categoria: "Ocio", tags: [] }],
      sinkingFunds: [],
      categories: [],
      budgets: [{ id: "b1", category_id: "missing", amount: 20, month: "2026-10" }],
    } as unknown as FinanceState
    const original = JSON.stringify(state)

    const findings = auditFinanceState(state)

    expect(findings.map((item) => item.code)).toContain("orphan-transactions")
    expect(findings.map((item) => item.code)).toContain("orphan-budgets")
    expect(findings.map((item) => item.code)).toContain("invalid-types")
    expect(findings.map((item) => item.code)).toContain("invalid-dates")
    expect(findings.map((item) => item.code)).toContain("balance-mismatch")
    expect(JSON.stringify(state)).toBe(original)
  })

  it("no marca como incidencias una cuenta con un historial coherente", () => {
    const state = {
      accounts: [{ id: "a1", nombre: "Cuenta", saldo: 15 }],
      transactions: [{ id: "t1", cuenta_id: "a1", monto: 20, fecha: "2026-10-01", tipo: "ingreso", categoria: "Salario", tags: [] }, { id: "t2", cuenta_id: "a1", monto: 5, fecha: "2026-10-02", tipo: "gasto", categoria: "Ocio", tags: [] }],
      sinkingFunds: [], categories: [], budgets: [],
    } as unknown as FinanceState
    expect(auditFinanceState(state)).toEqual([])
  })

  it("detecta inversiones huérfanas y aportes sin posición sin modificar registros", () => {
    const state = { accounts: [{ id: "a1", nombre: "Cuenta", saldo: 15 }], transactions: [], sinkingFunds: [], categories: [], budgets: [] } as unknown as FinanceState
    const positions: Position[] = [{ id: "p1", kind: "stock", symbol: "ABC", name: "Acción ABC", date: "2026-10-01", units: 1, buyPrice: 10, currency: "EUR" }]
    const contributions: Contribution[] = [{ id: "c1", positionId: "missing", amount: 10, date: "2026-10-01" }]
    const original = JSON.stringify({ state, positions, contributions })

    const findings = auditFinanceState(state, positions, contributions)

    expect(findings.map((item) => item.code)).toContain("orphan-positions")
    expect(findings.map((item) => item.code)).toContain("orphan-contributions")
    expect(findings.find((item) => item.code === "orphan-positions")?.details).toEqual(["Acción ABC"])
    expect(JSON.stringify({ state, positions, contributions })).toBe(original)
  })
})
