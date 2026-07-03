import { describe, it, expect } from "vitest"
import { reducer, defaultState, type Account, type Transaction, type Category, type FinanceState } from "./store"

const baseAccount: Account = {
  id: "acc1",
  nombre: "Principal",
  tipo: "efectivo",
  banco: "",
  saldo: 0,
  currency: "EUR",
  objetivo: null,
  limite_mensual: null,
  color: "#000",
}

const emptyState: FinanceState = {
  accounts: [],
  transactions: [],
  sinkingFunds: [],
  categories: [],
  budgets: [],
}

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    cuenta_id: "acc1",
    monto: 100,
    fecha: "2026-07-01",
    tipo: "gasto",
    categoria: "Ocio",
    es_necesidad: false,
    descripcion: "",
    tags: [],
    ...overrides,
  }
}

describe("reducer / ADD_ACCOUNT", () => {
  it("no crea transacción de saldo inicial si la cuenta arranca en 0", () => {
    const next = reducer(emptyState, { type: "ADD_ACCOUNT", payload: baseAccount })
    expect(next.transactions).toHaveLength(0)
    expect(next.accounts).toEqual([baseAccount])
  })

  it("crea una transacción 'init_' con el saldo inicial si la cuenta no arranca en 0", () => {
    const account = { ...baseAccount, saldo: 500 }
    const next = reducer(emptyState, { type: "ADD_ACCOUNT", payload: account })
    expect(next.transactions).toHaveLength(1)
    expect(next.transactions[0]).toMatchObject({ id: "init_acc1", cuenta_id: "acc1", monto: 500, tipo: "ingreso", categoria: "Saldo inicial" })
  })
})

describe("reducer / UPDATE_ACCOUNT", () => {
  it("genera una transacción de ajuste 'adj_' por la diferencia de saldo", () => {
    const state: FinanceState = { ...emptyState, accounts: [{ ...baseAccount, saldo: 100 }] }
    const next = reducer(state, { type: "UPDATE_ACCOUNT", payload: { ...baseAccount, saldo: 150 } })
    expect(next.accounts[0].saldo).toBe(150)
    const adj = next.transactions.find((t) => t.id.startsWith("adj_"))
    expect(adj).toMatchObject({ monto: 50, categoria: "Ajuste de saldo" })
  })

  it("no genera transacción de ajuste si el saldo no cambia", () => {
    const state: FinanceState = { ...emptyState, accounts: [{ ...baseAccount, saldo: 100 }] }
    const next = reducer(state, { type: "UPDATE_ACCOUNT", payload: { ...baseAccount, saldo: 100, nombre: "Renombrada" } })
    expect(next.transactions).toHaveLength(0)
    expect(next.accounts[0].nombre).toBe("Renombrada")
  })
})

describe("reducer / DELETE_ACCOUNT", () => {
  it("elimina la cuenta y en cascada sus transacciones y metas de ahorro vinculadas", () => {
    const state: FinanceState = {
      ...emptyState,
      accounts: [baseAccount, { ...baseAccount, id: "acc2" }],
      transactions: [tx({ cuenta_id: "acc1" }), tx({ id: "t2", cuenta_id: "acc2" })],
      sinkingFunds: [{ id: "sf1", nombre: "Meta", cantidad_objetivo: 1000, ahorrado_actual: 0, fecha_limite: "2027-01-01", cuenta_id: "acc1" }],
    }
    const next = reducer(state, { type: "DELETE_ACCOUNT", payload: "acc1" })
    expect(next.accounts.map((a) => a.id)).toEqual(["acc2"])
    expect(next.transactions.map((t) => t.id)).toEqual(["t2"])
    expect(next.sinkingFunds).toHaveLength(0)
  })
})

describe("reducer / ADD_TRANSACTION actualiza el saldo de la cuenta", () => {
  it("un gasto resta del saldo", () => {
    const state: FinanceState = { ...emptyState, accounts: [{ ...baseAccount, saldo: 200 }] }
    const next = reducer(state, { type: "ADD_TRANSACTION", payload: tx({ monto: 50, tipo: "gasto" }) })
    expect(next.accounts[0].saldo).toBe(150)
  })

  it("un ingreso suma al saldo", () => {
    const state: FinanceState = { ...emptyState, accounts: [{ ...baseAccount, saldo: 200 }] }
    const next = reducer(state, { type: "ADD_TRANSACTION", payload: tx({ monto: 50, tipo: "ingreso" }) })
    expect(next.accounts[0].saldo).toBe(250)
  })
})

describe("reducer / UPDATE_TRANSACTION reajusta el saldo", () => {
  it("revierte el efecto de la transacción anterior antes de aplicar la nueva", () => {
    const state: FinanceState = {
      ...emptyState,
      accounts: [{ ...baseAccount, saldo: 150 }], // ya refleja un gasto de 50 sobre 200
      transactions: [tx({ monto: 50, tipo: "gasto" })],
    }
    const next = reducer(state, { type: "UPDATE_TRANSACTION", payload: tx({ monto: 80, tipo: "gasto" }) })
    expect(next.accounts[0].saldo).toBe(120) // 150 + 50 (revierte) - 80 (aplica)
  })

  it("no toca el saldo al editar una transacción de saldo inicial (init_)", () => {
    const state: FinanceState = {
      ...emptyState,
      accounts: [{ ...baseAccount, saldo: 500 }],
      transactions: [tx({ id: "init_acc1", monto: 500, tipo: "ingreso", categoria: "Saldo inicial" })],
    }
    const next = reducer(state, { type: "UPDATE_TRANSACTION", payload: tx({ id: "init_acc1", monto: 999, tipo: "ingreso", categoria: "Saldo inicial" }) })
    expect(next.accounts[0].saldo).toBe(500)
    expect(next.transactions[0].monto).toBe(999)
  })
})

describe("reducer / DELETE_TRANSACTION revierte el saldo", () => {
  it("un gasto eliminado devuelve el importe a la cuenta", () => {
    const state: FinanceState = {
      ...emptyState,
      accounts: [{ ...baseAccount, saldo: 150 }],
      transactions: [tx({ monto: 50, tipo: "gasto" })],
    }
    const next = reducer(state, { type: "DELETE_TRANSACTION", payload: "t1" })
    expect(next.accounts[0].saldo).toBe(200)
    expect(next.transactions).toHaveLength(0)
  })

  it("un ajuste de saldo (adj_) SÍ revierte el saldo al borrarlo — solo 'init_' se excluye, ver isInitialTx", () => {
    const state: FinanceState = {
      ...emptyState,
      accounts: [{ ...baseAccount, saldo: 150 }],
      transactions: [tx({ id: "adj_1", monto: 50, tipo: "ingreso", categoria: "Ajuste de saldo" })],
    }
    const next = reducer(state, { type: "DELETE_TRANSACTION", payload: "adj_1" })
    expect(next.accounts[0].saldo).toBe(100)
  })
})

describe("reducer / ADD_CATEGORY", () => {
  const cat: Category = { id: "c1", name: "Suscripciones", color: "#000", kind: "gasto" }

  it("añade la categoría si el nombre no existe", () => {
    const next = reducer(emptyState, { type: "ADD_CATEGORY", payload: { name: "Ocio", color: "#000", kind: "gasto" } })
    expect(next.categories).toHaveLength(1)
    expect(next.categories[0].name).toBe("Ocio")
  })

  it("rechaza un nombre duplicado exacto", () => {
    const state: FinanceState = { ...emptyState, categories: [cat] }
    const next = reducer(state, { type: "ADD_CATEGORY", payload: { name: "Suscripciones", color: "#111", kind: "gasto" } })
    expect(next.categories).toHaveLength(1)
  })

  it("rechaza un duplicado con distinta capitalización o espacios sobrantes", () => {
    const state: FinanceState = { ...emptyState, categories: [cat] }
    const next = reducer(state, { type: "ADD_CATEGORY", payload: { name: "  suscripciones  ", color: "#111", kind: "gasto" } })
    expect(next.categories).toHaveLength(1)
  })
})

describe("reducer / DELETE_CATEGORY", () => {
  it("elimina en cascada los presupuestos que dependen de esa categoría", () => {
    const state: FinanceState = {
      ...emptyState,
      categories: [{ id: "c1", name: "Ocio", color: "#000", kind: "gasto" }],
      budgets: [
        { id: "b1", category_id: "c1", amount: 200, month: "2026-07", user_id: "u1" },
        { id: "b2", category_id: "c2", amount: 100, month: "2026-07", user_id: "u1" },
      ],
    }
    const next = reducer(state, { type: "DELETE_CATEGORY", payload: "c1" })
    expect(next.categories).toHaveLength(0)
    expect(next.budgets.map((b) => b.id)).toEqual(["b2"])
  })
})

describe("reducer / RESET", () => {
  it("vuelve al estado por defecto", () => {
    const state: FinanceState = { ...emptyState, transactions: [tx()] }
    expect(reducer(state, { type: "RESET" })).toBe(defaultState)
  })
})
