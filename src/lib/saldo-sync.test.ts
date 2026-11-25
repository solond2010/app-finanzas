import { describe, expect, it } from "vitest"
import {
  accountSaldoDivergesFromLedger,
  collectSaldoDeltas,
  shouldApplySaldoDelta,
  stripSaldoFromExistingAccounts,
  transactionsForSync,
} from "./saldo-sync"
import type { Account, FinanceState, Transaction } from "./store"
import { classifyTransactionWrites } from "./server/saldo-delta"

const account = (overrides: Partial<Account> = {}): Account => ({
  id: "acc1",
  nombre: "Caja",
  tipo: "efectivo",
  banco: "",
  saldo: 100,
  currency: "EUR",
  objetivo: null,
  limite_mensual: null,
  color: "#000",
  ...overrides,
})

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "t1",
  cuenta_id: "acc1",
  monto: 100,
  fecha: "2026-07-01",
  tipo: "ingreso",
  categoria: "Otros",
  es_necesidad: false,
  descripcion: "",
  tags: [],
  ...overrides,
})

const empty: FinanceState = { accounts: [], transactions: [], sinkingFunds: [], categories: [], budgets: [] }

describe("aviso de ajuste de saldo", () => {
  it("detecta cuando el saldo y el ledger no cuadran, y no si solo hay un residual sintético en memoria", () => {
    expect(accountSaldoDivergesFromLedger(account({ saldo: 50 }), [tx({ monto: 40 })])).toBe(true)
    expect(accountSaldoDivergesFromLedger(account({ saldo: 50 }), [tx({ monto: 50 })])).toBe(false)
    expect(accountSaldoDivergesFromLedger(account({ saldo: 50 }), [tx({ id: "adj_init_acc1", monto: 50, categoria: "Saldo inicial", localOnly: true })])).toBe(true)
  })
})

describe("sync payload", () => {
  it("no envía movimientos localOnly y quita el saldo de cuentas ya existentes", () => {
    expect(transactionsForSync([tx(), tx({ id: "adj_init_acc1", localOnly: true })]).map((t) => t.id)).toEqual(["t1"])
    const stripped = stripSaldoFromExistingAccounts(
      [{ id: "acc1", nombre: "A", saldo: 5 }, { id: "acc-new", nombre: "B", saldo: 8 }],
      new Set(["acc1"]),
    )
    expect(stripped[0]).toEqual({ id: "acc1", nombre: "A" })
    expect(stripped[1]).toEqual({ id: "acc-new", nombre: "B", saldo: 8 })
  })

  it("no aplica un delta en un reintento si el movimiento ya estaba", () => {
    expect(shouldApplySaldoDelta({ ifInserted: ["t1"] }, { inserted: ["t1"], deleted: [], updated: [] })).toBe(true)
    expect(shouldApplySaldoDelta({ ifInserted: ["t1"] }, { inserted: [], deleted: [], updated: [] })).toBe(false)
  })

  it("un movimiento nuevo produce un delta; no se recalcula el saldo entero", () => {
    const prev = { ...empty, accounts: [account({ saldo: 100 })] }
    const next = { ...empty, accounts: [account({ saldo: 70 })], transactions: [tx({ id: "g1", tipo: "gasto", monto: 30 })] }
    const { deltas, newAccountIds } = collectSaldoDeltas(prev, next, () => "d1")
    expect(newAccountIds).toEqual([])
    expect(deltas).toEqual([expect.objectContaining({ id: "d1", accountId: "acc1", delta: -30, ifInserted: ["g1"] })])
  })

  it("clasifica altas y cambios para no aplicar el delta dos veces", () => {
    const classified = classifyTransactionWrites(
      [{ id: "new", monto: 10, tipo: "gasto", cuenta_id: "acc1" }, { id: "old", monto: 8, tipo: "gasto", cuenta_id: "acc1" }],
      [{ id: "old", monto: 5, tipo: "gasto", cuenta_id: "acc1" }],
    )
    expect(classified.inserted).toEqual(["new"])
    expect(classified.updated).toEqual(["old"])
  })
})
