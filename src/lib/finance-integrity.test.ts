import { describe, expect, it } from "vitest"
import { auditFinanceState } from "./finance-integrity"
import type { FinanceState } from "./store"

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
})
