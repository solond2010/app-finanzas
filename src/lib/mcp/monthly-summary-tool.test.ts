import { describe, expect, it } from "vitest"
import { getMonthlySummaryTool, parseMonthKey } from "@/lib/mcp/monthly-summary-tool"
import { addTransactionTool, listAccountsTool, listCategoriesTool, listRecentTransactionsTool, signedAmount, type McpAccount, type McpCashFlowTx, type McpCategory, type McpPlanContext, type McpStore, type McpTransaction } from "@/lib/mcp/tools"

const account: McpAccount = { id: "acc-1", nombre: "Efectivo", saldo: 100, currency: "EUR" }
const comida: McpCategory = { id: "cat-1", name: "Comida", kind: "gasto" }
const nomina: McpCategory = { id: "cat-2", name: "Nómina", kind: "ingreso" }

function memoryStore(init?: { accounts?: McpAccount[]; categories?: McpCategory[]; transactions?: Array<McpTransaction & { tags?: string[] }>; plan?: McpPlanContext }): McpStore & { transactions: Array<McpTransaction & { tags?: string[] }>; inserted: number } {
  const accounts = (init?.accounts ?? [account]).map((item) => ({ ...item }))
  const categories = (init?.categories ?? [comida, nomina]).map((item) => ({ ...item }))
  const transactions = [...(init?.transactions ?? [])]
  const plan: McpPlanContext = init?.plan ?? {
    plan: "free",
    paymentsEnabled: true,
    source: null,
    accountCount: accounts.length,
    goalCount: 0,
  }
  const store: McpStore & { transactions: Array<McpTransaction & { tags?: string[] }>; inserted: number } = {
    transactions,
    inserted: 0,
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
      store.inserted += 1
      const created: McpTransaction & { tags?: string[] } = {
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
      return transactions.map((row): McpCashFlowTx => ({
        id: row.id,
        cuenta_id: row.cuenta_id,
        monto: row.monto,
        fecha: row.fecha,
        tipo: row.tipo,
        categoria: row.categoria,
        tags: row.tags ?? [],
      }))
    },
  }
  return store
}

const sampleTxs: Array<McpTransaction & { tags?: string[] }> = [
  { id: "tx-sep-in", cuenta_id: "acc-1", monto: 2000, fecha: "2026-09-10", tipo: "ingreso", categoria: "Nómina", descripcion: "", created_at: "2026-09-10T10:00:00.000Z" },
  { id: "tx-sep-out", cuenta_id: "acc-1", monto: 900, fecha: "2026-09-12", tipo: "gasto", categoria: "Comida", descripcion: "", created_at: "2026-09-12T10:00:00.000Z" },
  { id: "tx-oct-in", cuenta_id: "acc-1", monto: 1800, fecha: "2026-10-08", tipo: "ingreso", categoria: "Nómina", descripcion: "", created_at: "2026-10-08T10:00:00.000Z" },
  { id: "tx-oct-free", cuenta_id: "acc-1", monto: 400, fecha: "2026-10-09", tipo: "ingreso", categoria: "Freelance", descripcion: "", created_at: "2026-10-09T10:00:00.000Z" },
  { id: "tx-oct-house", cuenta_id: "acc-1", monto: 500, fecha: "2026-10-15", tipo: "gasto", categoria: "Vivienda", descripcion: "", created_at: "2026-10-15T10:00:00.000Z" },
  { id: "tx-oct-food", cuenta_id: "acc-1", monto: 280, fecha: "2026-10-16", tipo: "gasto", categoria: "Comida", descripcion: "", created_at: "2026-10-16T10:00:00.000Z" },
  { id: "init_acc-1", cuenta_id: "acc-1", monto: 10000, fecha: "2026-10-01", tipo: "ingreso", categoria: "Saldo inicial", descripcion: "", created_at: "2026-10-01T10:00:00.000Z" },
  { id: "xf_out", cuenta_id: "acc-1", monto: 1600, fecha: "2026-10-20", tipo: "gasto", categoria: "Transferencia", descripcion: "", created_at: "2026-10-20T10:00:00.000Z", tags: ["traspaso", "traspaso:inv-oct"] },
  { id: "xf_in", cuenta_id: "acc-2", monto: 1600, fecha: "2026-10-20", tipo: "ingreso", categoria: "Transferencia", descripcion: "", created_at: "2026-10-20T10:00:00.000Z", tags: ["traspaso", "traspaso:inv-oct"] },
  { id: "tx-nov", cuenta_id: "acc-1", monto: 50, fecha: "2026-11-02", tipo: "gasto", categoria: "Ocio", descripcion: "", created_at: "2026-11-02T10:00:00.000Z" },
]

describe("parseMonthKey", () => {
  it("usa el mes actual de Europe/Madrid si no se indica, y valida YYYY-MM", () => {
    expect(parseMonthKey(undefined, new Date("2026-11-26T23:30:00+01:00"))).toBe("2026-11")
    expect(parseMonthKey("", new Date("2026-11-26T00:30:00+01:00"))).toBe("2026-11")
    expect(parseMonthKey("2026-10")).toBe("2026-10")
    expect(parseMonthKey("2026-13")).toBeNull()
    expect(parseMonthKey("10/2026")).toBeNull()
  })
})

describe("get_monthly_summary", () => {
  it("resume ingresos, gastos, desglose y comparación, sin contar traspasos ni el saldo inicial", async () => {
    const store = memoryStore({ transactions: sampleTxs })
    const result = await getMonthlySummaryTool(store, "user-test", { month: "2026-10" }, new Date("2026-11-26T12:00:00+01:00"))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(store.inserted).toBe(0)
    expect(result.data.month).toBe("2026-10")
    expect(result.data.label).toBe("Octubre 2026")
    expect(result.data.income).toBe(2200)
    expect(result.data.expenses).toBe(780)
    expect(result.data.net).toBe(1420)
    expect(result.data.previous).toEqual({ month: "2026-09", income: 2000, expenses: 900, net: 1100 })
    expect(result.data.incomeDelta).toBe(200)
    expect(result.data.expensesDelta).toBe(-120)
    expect(result.data.netDelta).toBe(320)
    expect(result.data.incomeByCategory).toEqual([
      { name: "Nómina", amount: 1800 },
      { name: "Freelance", amount: 400 },
    ])
    expect(result.data.expensesByCategory).toEqual([
      { name: "Vivienda", amount: 500 },
      { name: "Comida", amount: 280 },
    ])
  })

  it("si no se indica mes, usa el mes actual en Europe/Madrid y no escribe nada", async () => {
    const store = memoryStore({ transactions: sampleTxs })
    const result = await getMonthlySummaryTool(store, "user-test", {}, new Date("2026-11-26T23:10:00+01:00"))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(store.inserted).toBe(0)
    expect(store.transactions).toHaveLength(sampleTxs.length)
    expect(result.data.month).toBe("2026-11")
    expect(result.data.label).toBe("Noviembre 2026")
    expect(result.data.expenses).toBe(50)
    expect(result.data.income).toBe(0)
    expect(result.data.previous.month).toBe("2026-10")
    expect(result.data.previous.income).toBe(2200)
    expect(result.data.expensesByCategory).toEqual([{ name: "Ocio", amount: 50 }])
  })

  it("rechaza un mes inválido sin consultar ni escribir", async () => {
    const store = memoryStore({ transactions: sampleTxs })
    const result = await getMonthlySummaryTool(store, "user-test", { month: "noviembre" })
    expect(result).toEqual({ ok: false, status: 400, error: "month debe tener el formato YYYY-MM" })
    expect(store.inserted).toBe(0)
  })
})

describe("las herramientas MCP actuales siguen igual", () => {
  it("sigue listando, apuntando y consultando recientes sin romper el resumen", async () => {
    const store = memoryStore()
    const accounts = await listAccountsTool(store, "user-test")
    const categories = await listCategoriesTool(store, "user-test")
    expect(accounts.ok && accounts.data).toEqual([account])
    expect(categories.ok && categories.data.map((item) => item.name)).toEqual(["Comida", "Nómina"])
    const added = await addTransactionTool(store, "user-test", {
      tipo: "gasto",
      monto: 12.5,
      cuenta: "Efectivo",
      categoria: "Comida",
      fecha: "2026-11-25",
    })
    expect(added.ok).toBe(true)
    const recent = await listRecentTransactionsTool(store, "user-test", { limit: 10 })
    expect(recent.ok && recent.data).toHaveLength(1)
  })
})
