import { describe, it, expect } from "vitest"
import { reducer, defaultState, collectDeletesFromAction, emptyPendingDeletes, normalizeFinanceState, type Account, type Transaction, type Category, type FinanceState, hasRemoteData, hydrateFinanceState, isFinanceState, categoriesForSync } from "./store"
import { cleanLoadSyncWrites, collectSaldoDeltas } from "./saldo-sync"

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

describe("reducer / ADD_TRANSACTION tienda", () => {
  it("conserva la tienda al crear o actualizar un gasto de súper", () => {
    const withStore = tx({ id: "super1", categoria: "Supermercado", tienda: "Mercadona" })
    const added = reducer({ ...emptyState, accounts: [baseAccount] }, { type: "ADD_TRANSACTION", payload: withStore })
    expect(added.transactions[0].tienda).toBe("Mercadona")
    const updated = reducer(added, { type: "UPDATE_TRANSACTION", payload: { ...withStore, tienda: "Lidl" } })
    expect(updated.transactions.find((item) => item.id === "super1")?.tienda).toBe("Lidl")
  })
})

describe("reducer / SET_STATE", () => {
  it("marca el residual de saldo con un ID que no se confunde con una apertura real", () => {
    const state: FinanceState = {
      ...emptyState,
      accounts: [{ ...baseAccount, saldo: 100 }],
      transactions: [tx({ id: "income", tipo: "ingreso", monto: 200, categoria: "Salario" })],
    }
    const next = reducer(state, { type: "SET_STATE", payload: state })
    expect(next.transactions.find((transaction) => transaction.id.startsWith("adj_init_"))).toMatchObject({
      cuenta_id: "acc1",
      monto: 100,
      tipo: "gasto",
      categoria: "Saldo inicial",
      localOnly: true,
    })
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

  it("registra una corrección a la baja como ajuste y deja el saldo exacto", () => {
    const state: FinanceState = { ...emptyState, accounts: [{ ...baseAccount, saldo: 100 }] }
    const next = reducer(state, { type: "UPDATE_ACCOUNT", payload: { ...baseAccount, saldo: 80 } })
    const adj = next.transactions.find((t) => t.id.startsWith("adj_"))
    expect(next.accounts[0].saldo).toBe(80)
    expect(adj).toMatchObject({ monto: -20, tipo: "ingreso", categoria: "Ajuste de saldo" })
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

  it("desetiqueta la pata restante de un traspaso entre monedas al borrar una cuenta", () => {
    const state: FinanceState = {
      ...emptyState,
      accounts: [baseAccount, { ...baseAccount, id: "acc2", currency: "USD" }],
      transactions: [
        tx({ id: "fx-out", cuenta_id: "acc1", tipo: "gasto", monto: 100, tags: ["traspaso", "traspaso:fx-1"] }),
        tx({ id: "fx-in", cuenta_id: "acc2", tipo: "ingreso", monto: 92, tags: ["traspaso", "traspaso:fx-1"] }),
      ],
    }
    const next = reducer(state, { type: "DELETE_ACCOUNT", payload: "acc1" })
    expect(next.transactions).toHaveLength(1)
    expect(next.transactions[0].tags).toEqual([])
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

  it("aplica una importación por lotes al historial y al saldo en una sola acción", () => {
    const state: FinanceState = { ...emptyState, accounts: [{ ...baseAccount, saldo: 200 }] }
    const next = reducer(state, { type: "ADD_TRANSACTIONS", payload: [tx({ id: "batch1", monto: 30, tipo: "gasto" }), tx({ id: "batch2", monto: 10, tipo: "ingreso" })] })
    expect(next.transactions.map((item) => item.id)).toEqual(["batch1", "batch2"])
    expect(next.accounts[0].saldo).toBe(180)
  })

  it("registra las dos patas de un traspaso en una sola acción y con importes por divisa", () => {
    const state: FinanceState = {
      ...emptyState,
      accounts: [baseAccount, { ...baseAccount, id: "acc-usd", currency: "USD", saldo: 100 }],
    }
    const pairTag = "traspaso:fx-1"
    const next = reducer(state, {
      type: "ADD_TRANSFER",
      payload: [
        tx({ id: "fx-out", cuenta_id: "acc1", tipo: "gasto", monto: 100, tags: ["traspaso", pairTag] }),
        tx({ id: "fx-in", cuenta_id: "acc-usd", tipo: "ingreso", monto: 92, tags: ["traspaso", pairTag] }),
      ],
    })
    expect(next.accounts.map((account) => account.saldo)).toEqual([-100, 192])
    expect(next.transactions.map((transaction) => transaction.id)).toEqual(["fx-out", "fx-in"])
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

  it("al editar un saldo inicial también reajusta el saldo de la cuenta", () => {
    const state: FinanceState = {
      ...emptyState,
      accounts: [{ ...baseAccount, saldo: 500 }],
      transactions: [tx({ id: "init_acc1", monto: 500, tipo: "ingreso", categoria: "Saldo inicial" })],
    }
    const next = reducer(state, { type: "UPDATE_TRANSACTION", payload: tx({ id: "init_acc1", monto: 999, tipo: "ingreso", categoria: "Saldo inicial" }) })
    expect(next.accounts[0].saldo).toBe(999)
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

  it("un ajuste de saldo (adj_) SÍ revierte el saldo al borrarlo", () => {
    const state: FinanceState = {
      ...emptyState,
      accounts: [{ ...baseAccount, saldo: 150 }],
      transactions: [tx({ id: "adj_1", monto: 50, tipo: "ingreso", categoria: "Ajuste de saldo" })],
    }
    const next = reducer(state, { type: "DELETE_TRANSACTION", payload: "adj_1" })
    expect(next.accounts[0].saldo).toBe(100)
  })

  it("borrar el saldo inicial de una cuenta nueva también mueve el saldo", () => {
    const created = reducer(emptyState, { type: "ADD_ACCOUNT", payload: { ...baseAccount, saldo: 80 } })
    expect(created.accounts[0].saldo).toBe(80)
    const next = reducer(created, { type: "DELETE_TRANSACTION", payload: "init_acc1" })
    expect(next.transactions).toHaveLength(0)
    expect(next.accounts[0].saldo).toBe(0)
  })

  it("borrar un residual sintético localOnly no toca el saldo", () => {
    const state: FinanceState = {
      ...emptyState,
      accounts: [{ ...baseAccount, saldo: 110 }],
      transactions: [tx({ id: "adj_init_acc1", monto: 110, tipo: "ingreso", categoria: "Saldo inicial", localOnly: true })],
    }
    const next = reducer(state, { type: "DELETE_TRANSACTION", payload: "adj_init_acc1" })
    expect(next.transactions).toHaveLength(0)
    expect(next.accounts[0].saldo).toBe(110)
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

  it("permite el mismo nombre en ingreso y en gasto (Inversión)", () => {
    const state: FinanceState = {
      ...emptyState,
      categories: [{ id: "cat_inversion", name: "Inversión", color: "#000", kind: "ingreso" }],
    }
    const next = reducer(state, { type: "ADD_CATEGORY", payload: { id: "cat_inv_gasto", name: "Inversión", color: "#111", kind: "gasto" } })
    expect(next.categories).toHaveLength(2)
    expect(next.categories.map((c) => c.kind).sort()).toEqual(["gasto", "ingreso"])
  })

  it("rechaza Inversión como gasto si ya existe en Ambos", () => {
    const state: FinanceState = {
      ...emptyState,
      categories: [{ id: "c-both", name: "Inversión", color: "#000", kind: "both" }],
    }
    const next = reducer(state, { type: "ADD_CATEGORY", payload: { name: "Inversión", color: "#111", kind: "gasto" } })
    expect(next.categories).toHaveLength(1)
  })

  it("rechaza crear como Ambos si ya existe en Ingresos", () => {
    const state: FinanceState = {
      ...emptyState,
      categories: [{ id: "c-in", name: "Inversión", color: "#000", kind: "ingreso" }],
    }
    const next = reducer(state, { type: "ADD_CATEGORY", payload: { name: "Inversión", color: "#111", kind: "both" } })
    expect(next.categories).toHaveLength(1)
  })
})

describe("reducer / UPDATE_CATEGORY", () => {
  it("al renombrar un gasto no mueve los ingresos homónimos", () => {
    const state: FinanceState = {
      ...emptyState,
      categories: [
        { id: "c-in", name: "Inversión", color: "#000", kind: "ingreso" },
        { id: "c-out", name: "Inversión", color: "#111", kind: "gasto" },
      ],
      transactions: [
        tx({ id: "t-in", tipo: "ingreso", categoria: "Inversión", monto: 100 }),
        tx({ id: "t-out", tipo: "gasto", categoria: "Inversión", monto: 20 }),
      ],
    }
    const next = reducer(state, {
      type: "UPDATE_CATEGORY",
      payload: { id: "c-out", name: "Inversiones", color: "#111", kind: "gasto" },
    })
    expect(next.transactions.find((t) => t.id === "t-out")?.categoria).toBe("Inversiones")
    expect(next.transactions.find((t) => t.id === "t-in")?.categoria).toBe("Inversión")
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


describe("collectDeletesFromAction", () => {
  it("marca cuenta + txs + sinking funds en cascada al borrar una cuenta", () => {
    const state: FinanceState = {
      ...emptyState,
      accounts: [baseAccount],
      transactions: [tx({ id: "t1", cuenta_id: "acc1" }), tx({ id: "t2", cuenta_id: "other" })],
      sinkingFunds: [{ id: "sf1", nombre: "Meta", cantidad_objetivo: 1000, ahorrado_actual: 0, fecha_limite: "2027-01-01", cuenta_id: "acc1" }],
    }
    const pending = emptyPendingDeletes()
    collectDeletesFromAction(state, { type: "DELETE_ACCOUNT", payload: "acc1" }, pending)
    expect([...pending.accounts]).toEqual(["acc1"])
    expect([...pending.transactions]).toEqual(["t1"])
    expect([...pending.sinking_funds]).toEqual(["sf1"])
  })

  it("en RESET solo marca cuentas/categorías que no forman parte del estado por defecto", () => {
    const state: FinanceState = {
      ...defaultState,
      accounts: [...defaultState.accounts, { ...baseAccount, id: "acc_custom" }],
      transactions: [tx({ id: "t1" })],
      categories: [...defaultState.categories, { id: "cat_custom", name: "Custom", color: "#000", kind: "gasto" }],
    }
    const pending = emptyPendingDeletes()
    collectDeletesFromAction(state, { type: "RESET" }, pending)
    expect([...pending.accounts]).toEqual(["acc_custom"])
    expect([...pending.transactions]).toEqual(["t1"])
    expect([...pending.categories]).toEqual(["cat_custom"])
    expect(pending.accounts.has("acc_principal")).toBe(false)
  })

  it("no mete en pendingDeletes un inicial sintético localOnly", () => {
    const state: FinanceState = {
      ...emptyState,
      accounts: [baseAccount],
      transactions: [tx({ id: "adj_init_acc1", categoria: "Saldo inicial", localOnly: true })],
    }
    const pending = emptyPendingDeletes()
    collectDeletesFromAction(state, { type: "DELETE_TRANSACTION", payload: "adj_init_acc1" }, pending)
    expect([...pending.transactions]).toEqual([])
  })
})

describe("carga limpia no escribe datos existentes", () => {
  it("oculta init_ fantasma en memoria y no planifica borrados, altas ni cambios de saldo", () => {
    const remote: FinanceState = {
      ...emptyState,
      accounts: [
        { ...baseAccount, id: "c4", saldo: 6 },
        { ...baseAccount, id: "c5", saldo: 0 },
        { ...baseAccount, id: "c8", tipo: "inversion", saldo: 110 },
        { ...baseAccount, id: "ok", saldo: 20 },
      ],
      transactions: [
        tx({ id: "otros4", cuenta_id: "c4", tipo: "ingreso", categoria: "Otros", monto: 65 }),
        tx({ id: "init_c4", cuenta_id: "c4", tipo: "ingreso", categoria: "Saldo inicial", monto: 65 }),
        tx({ id: "out4", cuenta_id: "c4", tipo: "gasto", categoria: "Ocio", monto: 59 }),
        tx({ id: "otros5", cuenta_id: "c5", tipo: "ingreso", categoria: "Otros", monto: 25 }),
        tx({ id: "init_c5", cuenta_id: "c5", tipo: "ingreso", categoria: "Saldo inicial", monto: 25 }),
        tx({ id: "out5", cuenta_id: "c5", tipo: "gasto", categoria: "Transferencia", monto: 25 }),
        tx({ id: "init_ok", cuenta_id: "ok", tipo: "ingreso", categoria: "Saldo inicial", monto: 20 }),
      ],
    }
    const local = normalizeFinanceState(remote)
    const pending = emptyPendingDeletes()
    collectDeletesFromAction(remote, { type: "SET_STATE", payload: remote }, pending)
    const writes = cleanLoadSyncWrites(remote, local, [...pending.transactions])
    expect(writes.hiddenPhantomInitIds.sort()).toEqual(["init_c4", "init_c5"])
    expect(local.transactions.some((t) => t.id === "init_c4" || t.id === "init_c5")).toBe(false)
    expect(local.transactions.find((t) => t.id === "adj_init_c8")).toMatchObject({ localOnly: true, monto: 110 })
    expect(writes.wouldUploadNewTransactions).toEqual([])
    expect(writes.wouldDeleteTransactions).toEqual([])
    expect(writes.wouldSendSaldoDeltas).toEqual([])
    expect(local.accounts.map((a) => a.saldo)).toEqual(remote.accounts.map((a) => a.saldo))
  })

  it("un movimiento nuevo sí genera un delta de saldo, una importación que conserva el saldo no", () => {
    const state: FinanceState = { ...emptyState, accounts: [{ ...baseAccount, saldo: 50 }] }
    const afterAdd = reducer(state, { type: "ADD_TRANSACTION", payload: tx({ id: "g1", tipo: "gasto", monto: 10 }) })
    expect(collectSaldoDeltas(state, afterAdd).deltas).toEqual([
      expect.objectContaining({ accountId: "acc1", delta: -10, ifInserted: ["g1"] }),
    ])
    const imported = reducer(afterAdd, {
      type: "IMPORT_TRANSACTIONS",
      payload: [tx({ id: "imp1", tipo: "gasto", monto: 7, fecha: "2026-06-01" })],
      accountId: "acc1",
      keepBalance: true,
    })
    expect(imported.accounts[0].saldo).toBe(afterAdd.accounts[0].saldo)
    expect(collectSaldoDeltas(afterAdd, imported).deltas).toEqual([])
  })
})

import { mergeDefaultCategories } from "./store"
describe("mergeDefaultCategories (categorías borradas no vuelven)", () => {
  it("cuenta nueva sin categorías: siembra las predeterminadas", () => {
    expect(mergeDefaultCategories([]).length).toBe(defaultState.categories.length)
  })
  it("no vuelve a añadir las predeterminadas que el usuario borró", () => {
    const kept = defaultState.categories.slice(0, 3)
    const merged = mergeDefaultCategories(kept)
    expect(merged.map((c) => c.id)).toEqual(kept.map((c) => c.id))
  })
  it("rellena kind de las antiguas y deja «both» en las personalizadas", () => {
    const first = defaultState.categories[0]
    const merged = mergeDefaultCategories([{ ...first, kind: undefined }, { id: "cat_x", name: "X", color: "#000" }])
    expect(merged[0].kind).toBe(first.kind)
    expect(merged[1].kind).toBe("both")
  })
})


describe("hasRemoteData", () => {
  const empty = { accounts: [], transactions: [], sinkingFunds: [], categories: [{ id: "c1", name: "X", kind: "both" as const }], budgets: [] }
  it("no cuenta solo categorías como datos del usuario", () => {
    expect(hasRemoteData(empty as never)).toBe(false)
    expect(hasRemoteData(null)).toBe(false)
  })
  it("sí cuenta cuentas o movimientos", () => {
    expect(hasRemoteData({ ...empty, accounts: [{ id: "a" }] } as never)).toBe(true)
    expect(hasRemoteData({ ...empty, transactions: [{ id: "t" }] } as never)).toBe(true)
  })
})

import { DEFAULT_CATEGORY_COLOR } from "./category-color"

function baseState(overrides: Partial<FinanceState> = {}): FinanceState {
  return { accounts: [], transactions: [], sinkingFunds: [], categories: [], budgets: [], ...overrides }
}

describe("hydrateFinanceState y color de categoría vacío", () => {
  const account: Account = { id: "acc-1", nombre: "Cuenta", tipo: "efectivo", banco: "", saldo: 10, currency: "EUR", objetivo: null, limite_mensual: null, color: "" }
  const tx: Transaction = { id: "tx-1", cuenta_id: "acc-1", monto: 1.23, fecha: "2026-11-26", tipo: "gasto", categoria: "Prueba MCP", es_necesidad: false, descripcion: "", tags: ["mcp"] }

  it("isFinanceState acepta una categoría con color null o vacío", () => {
    const state = baseState({
      accounts: [account],
      transactions: [tx],
      categories: [{ id: "mcp-test-cat-1", name: "Prueba MCP", color: null as unknown as string, kind: "both" }],
    })
    expect(isFinanceState(state)).toBe(true)
    expect(isFinanceState(baseState({ categories: [{ id: "c1", name: "X", color: "" }] }))).toBe(true)
  })

  it("al cargar, el color vacío se normaliza al default y no se reescribe en el sync", () => {
    const hydrated = hydrateFinanceState({
      accounts: [account],
      transactions: [tx],
      sinkingFunds: [],
      categories: [
        { id: "mcp-test-cat-1", name: "Prueba MCP", color: null, kind: "both" },
        { id: "cat_alquiler", name: "Alquiler", color: "#ef4444", kind: "gasto" },
      ],
      budgets: [],
    })
    expect(hydrated).not.toBeNull()
    expect(hydrated!.accounts).toHaveLength(1)
    expect(hydrated!.transactions).toHaveLength(1)
    const [defaulted, intact] = hydrated!.categories
    expect(defaulted.color).toBe(DEFAULT_CATEGORY_COLOR)
    expect(defaulted.colorDefaulted).toBe(true)
    expect(intact.color).toBe("#ef4444")
    expect(intact.colorDefaulted).toBeUndefined()

    const payload = categoriesForSync(hydrated!.categories)
    expect(payload[0]).toEqual({ id: "mcp-test-cat-1", name: "Prueba MCP", kind: "both" })
    expect("color" in payload[0]).toBe(false)
    expect("colorDefaulted" in payload[0]).toBe(false)
    expect(payload[1]).toEqual({ id: "cat_alquiler", name: "Alquiler", color: "#ef4444", kind: "gasto" })
  })

  it("un elemento irrecuperable se descarta y el resto del estado se conserva", () => {
    const hydrated = hydrateFinanceState({
      accounts: [account, { id: "bad", nombre: "Rota", saldo: "no-número" }],
      transactions: [tx, { id: "tx-bad", cuenta_id: "acc-1", monto: 5, fecha: "2026-11-26", tipo: "otro", categoria: "X", tags: [] }],
      sinkingFunds: [],
      categories: [
        { id: "ok", name: "Ok", color: "#000" },
        { name: "Sin id", color: "#000" },
        { id: "c-empty", name: "Vacía", color: "  " },
      ],
      budgets: [{ id: "b1", category_id: "ok", amount: 10, month: "2026-11" }, { id: "b-bad", category_id: "ok", amount: "x", month: "2026-11" }],
    })
    expect(hydrated).not.toBeNull()
    expect(hydrated!.accounts.map((a) => a.id)).toEqual(["acc-1"])
    expect(hydrated!.transactions.map((t) => t.id)).toEqual(["tx-1"])
    expect(hydrated!.categories.map((c) => c.id)).toEqual(["ok", "c-empty"])
    expect(hydrated!.categories[1].color).toBe(DEFAULT_CATEGORY_COLOR)
    expect(hydrated!.budgets.map((b) => b.id)).toEqual(["b1"])
  })

  it("UPDATE_CATEGORY conserva colorDefaulted si el color no cambia, y lo quita si el usuario elige color", () => {
    const start: FinanceState = {
      ...baseState(),
      categories: [{ id: "c1", name: "Prueba MCP", color: DEFAULT_CATEGORY_COLOR, kind: "both", colorDefaulted: true }],
    }
    const kept = reducer(start, { type: "UPDATE_CATEGORY", payload: { id: "c1", name: "Prueba MCP", color: DEFAULT_CATEGORY_COLOR, kind: "both" } })
    expect(kept.categories[0].colorDefaulted).toBe(true)
    expect(categoriesForSync(kept.categories)[0]).not.toHaveProperty("color")

    const changed = reducer(start, { type: "UPDATE_CATEGORY", payload: { id: "c1", name: "Prueba MCP", color: "#ef4444", kind: "both" } })
    expect(changed.categories[0].colorDefaulted).toBeUndefined()
    expect(categoriesForSync(changed.categories)[0].color).toBe("#ef4444")
  })

  it("ADD_CATEGORY sin color usa el default (categoría nueva, sí se sincroniza el color)", () => {
    const next = reducer(baseState(), { type: "ADD_CATEGORY", payload: { id: "c-new", name: "Nueva", color: "", kind: "gasto" } })
    expect(next.categories[0].color).toBe(DEFAULT_CATEGORY_COLOR)
    expect(next.categories[0].colorDefaulted).toBeUndefined()
    expect(categoriesForSync(next.categories)[0].color).toBe(DEFAULT_CATEGORY_COLOR)
  })
})
