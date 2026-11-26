import { describe, expect, it } from "vitest"
import {
  addTransactionTool,
  canCreateAccountForPlan,
  categoryMatchesTipo,
  ledgerSaldo,
  listAccountsTool,
  listCategoriesTool,
  listRecentTransactionsTool,
  parseFecha,
  parseLimit,
  parseMonto,
  parseTipo,
  signedAmount,
  type McpAccount,
  type McpCategory,
  type McpPlanContext,
  type McpStore,
  type McpTransaction,
} from "@/lib/mcp/tools"

const account: McpAccount = { id: "acc-1", nombre: "Efectivo", saldo: 100, currency: "EUR" }
const comida: McpCategory = { id: "cat-1", name: "Comida", kind: "gasto" }
const nomina: McpCategory = { id: "cat-2", name: "Nómina", kind: "ingreso" }
const general: McpCategory = { id: "cat-3", name: "General", kind: "both" }

function memoryStore(init?: { accounts?: McpAccount[]; categories?: McpCategory[]; transactions?: McpTransaction[]; plan?: McpPlanContext }): McpStore & { transactions: McpTransaction[]; accounts: McpAccount[] } {
  const accounts = (init?.accounts ?? [account]).map((item) => ({ ...item }))
  const categories = (init?.categories ?? [comida, nomina, general]).map((item) => ({ ...item }))
  const transactions = [...(init?.transactions ?? [])]
  const plan: McpPlanContext = init?.plan ?? {
    plan: "free",
    paymentsEnabled: true,
    source: null,
    accountCount: accounts.length,
    goalCount: 0,
  }
  const store: McpStore & { transactions: McpTransaction[]; accounts: McpAccount[] } = {
    accounts,
    transactions,
    async listAccounts() { return accounts },
    async listCategories() { return categories },
    async findAccount(_userId, idOrName) {
      const needle = idOrName.trim().toLocaleLowerCase("es")
      return accounts.find((item) => item.id === idOrName || item.nombre.toLocaleLowerCase("es") === needle) ?? null
    },
    async findCategory(_userId, idOrName) {
      const needle = idOrName.trim().toLocaleLowerCase("es")
      return categories.find((item) => item.id === idOrName || item.name.toLocaleLowerCase("es") === needle) ?? null
    },
    async getPlan() { return { ...plan, accountCount: accounts.length } },
    async insertTransaction(_userId, input) {
      const created: McpTransaction = {
        id: `tx-${transactions.length + 1}`,
        cuenta_id: input.account.id,
        monto: input.monto,
        fecha: input.fecha,
        tipo: input.tipo,
        categoria: input.category.name,
        descripcion: input.descripcion,
        created_at: "2026-11-25T12:00:00.000Z",
      }
      transactions.push(created)
      const target = accounts.find((item) => item.id === input.account.id)
      if (target) target.saldo += signedAmount(input.tipo, input.monto)
      return created
    },
    async listRecentTransactions(_userId, limit) {
      return [...transactions].reverse().slice(0, limit)
    },
    async listCashFlowTransactions() {
      return transactions.map((row) => ({
        id: row.id,
        cuenta_id: row.cuenta_id,
        monto: row.monto,
        fecha: row.fecha,
        tipo: row.tipo,
        categoria: row.categoria,
        tags: [],
      }))
    },
  }
  return store
}

describe("validación MCP", () => {
  it("parsea importes con coma y rechaza valores inválidos", () => {
    expect(parseMonto("12,50")).toBe(12.5)
    expect(parseMonto(3.456)).toBe(3.46)
    expect(parseMonto(0)).toBeNull()
    expect(parseMonto(-5)).toBeNull()
    expect(parseMonto("abc")).toBeNull()
    expect(parseMonto(2_000_000)).toBeNull()
  })

  it("exige tipo gasto o ingreso y una fecha ISO", () => {
    expect(parseTipo("gasto")).toBe("gasto")
    expect(parseTipo("traspaso")).toBeNull()
    expect(parseFecha("2026-11-25")).toBe("2026-11-25")
    expect(parseFecha("25/11/2026")).toBeNull()
    expect(parseFecha(undefined, new Date("2026-11-25T23:30:00+01:00"))).toBe("2026-11-25")
    expect(parseLimit(10)).toBe(10)
    expect(parseLimit(0)).toBeNull()
    expect(parseLimit(51)).toBeNull()
  })

  it("firma el saldo igual que el cliente y el trigger SQL", () => {
    expect(signedAmount("gasto", 20)).toBe(-20)
    expect(signedAmount("ingreso", 20)).toBe(20)
    expect(ledgerSaldo([
      { tipo: "ingreso", monto: 100 },
      { tipo: "gasto", monto: 30 },
      { tipo: "traspaso", monto: 10 },
    ])).toBe(60)
  })

  it("comprueba que la categoría corresponda al tipo", () => {
    expect(categoryMatchesTipo(comida, "gasto")).toBe(true)
    expect(categoryMatchesTipo(comida, "ingreso")).toBe(false)
    expect(categoryMatchesTipo(general, "ingreso")).toBe(true)
  })

  it("respeta el tope de cuentas del plan solo al crear cuentas, no al apuntar un movimiento", () => {
    const atCap: McpPlanContext = { plan: "free", paymentsEnabled: true, source: null, accountCount: 3, goalCount: 0 }
    expect(canCreateAccountForPlan(atCap)).toBe(false)
    expect(canCreateAccountForPlan({ ...atCap, accountCount: 2 })).toBe(true)
  })
})

describe("herramientas MCP", () => {
  it("lista cuentas y categorías del usuario", async () => {
    const store = memoryStore()
    const accounts = await listAccountsTool(store, "user-test")
    const categories = await listCategoriesTool(store, "user-test")
    expect(accounts.ok && accounts.data).toEqual([account])
    expect(categories.ok && categories.data.map((item) => item.name)).toEqual(["Comida", "Nómina", "General"])
  })

  it("apunta un gasto, actualiza el saldo y no pisa otros movimientos", async () => {
    const store = memoryStore({
      transactions: [{
        id: "tx-previo",
        cuenta_id: "acc-1",
        monto: 8,
        fecha: "2026-11-20",
        tipo: "gasto",
        categoria: "Comida",
        descripcion: "ya existía",
        created_at: "2026-11-20T10:00:00.000Z",
      }],
    })
    const result = await addTransactionTool(store, "user-test", {
      tipo: "gasto",
      monto: "12,50",
      cuenta: "Efectivo",
      categoria: "comida",
      fecha: "2026-11-25",
      nota: "Café",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.monto).toBe(12.5)
    expect(result.data.categoria).toBe("Comida")
    expect(result.data.descripcion).toBe("Café")
    expect(store.accounts[0].saldo).toBe(87.5)
    expect(store.transactions.map((item) => item.id)).toEqual(["tx-previo", "tx-2"])
  })

  it("apunta un ingreso por id de cuenta y categoría", async () => {
    const store = memoryStore()
    const result = await addTransactionTool(store, "user-test", {
      tipo: "ingreso",
      monto: 50,
      cuenta_id: "acc-1",
      categoria_id: "cat-2",
    }, new Date("2026-11-25T08:00:00+01:00"))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.tipo).toBe("ingreso")
    expect(result.data.fecha).toBe("2026-11-25")
    expect(store.accounts[0].saldo).toBe(150)
  })

  it("rechaza entradas inválidas sin escribir", async () => {
    const store = memoryStore()
    const badTipo = await addTransactionTool(store, "user-test", { tipo: "traspaso", monto: 10, cuenta: "Efectivo", categoria: "Comida" })
    const badAccount = await addTransactionTool(store, "user-test", { tipo: "gasto", monto: 10, cuenta: "No existe", categoria: "Comida" })
    const badKind = await addTransactionTool(store, "user-test", { tipo: "ingreso", monto: 10, cuenta: "Efectivo", categoria: "Comida" })
    expect(badTipo).toEqual({ ok: false, status: 400, error: "tipo debe ser gasto o ingreso" })
    expect(badAccount).toEqual({ ok: false, status: 400, error: "La cuenta no existe" })
    expect(badKind).toEqual({ ok: false, status: 400, error: "La categoría no corresponde al tipo de movimiento" })
    expect(store.transactions).toHaveLength(0)
    expect(store.accounts[0].saldo).toBe(100)
  })

  it("lista los movimientos recientes con un límite", async () => {
    const store = memoryStore()
    await addTransactionTool(store, "user-test", { tipo: "gasto", monto: 1, cuenta: "Efectivo", categoria: "Comida", fecha: "2026-11-01" })
    await addTransactionTool(store, "user-test", { tipo: "gasto", monto: 2, cuenta: "Efectivo", categoria: "Comida", fecha: "2026-11-02" })
    const listed = await listRecentTransactionsTool(store, "user-test", { limit: 1 })
    expect(listed.ok && listed.data.map((item) => item.monto)).toEqual([2])
    const bad = await listRecentTransactionsTool(store, "user-test", { limit: 99 })
    expect(bad.ok).toBe(false)
  })

  it("permite apuntar un movimiento en un plan gratuito que ya está en el tope de cuentas", async () => {
    const store = memoryStore({
      plan: { plan: "free", paymentsEnabled: true, source: null, accountCount: 3, goalCount: 2 },
    })
    const result = await addTransactionTool(store, "user-test", {
      tipo: "gasto",
      monto: 4,
      cuenta: "Efectivo",
      categoria: "Comida",
      fecha: "2026-11-25",
    })
    expect(result.ok).toBe(true)
  })
})

describe("add_transaction no crea categorías", () => {
  it("rechaza una categoría inexistente y no inserta ninguna fila en categories", async () => {
    const store = memoryStore({
      accounts: [{ id: "acc-1", nombre: "Cuenta", saldo: 10, currency: "EUR" }],
      categories: [{ id: "cat_comida", name: "Comida", kind: "gasto" }],
    })
    const before = (await store.listCategories("user-test")).map((item) => item.id)
    const result = await addTransactionTool(store, "user-test", {
      cuenta: "acc-1",
      tipo: "gasto",
      monto: 1,
      categoria: "NoExiste",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/categoría no existe/i)
    const after = (await store.listCategories("user-test")).map((item) => item.id)
    expect(after).toEqual(before)
    expect(after).toEqual(["cat_comida"])
  })
})
