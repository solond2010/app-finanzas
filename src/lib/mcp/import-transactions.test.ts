import { describe, expect, it } from "vitest"
import {
  descriptionsAreSimilar,
  importRowLimitError,
  importTransactionsTool,
  parseImportAmount,
  parseImportDate,
  previewImportTransactionsTool,
  type McpImportPreviewRecord,
  type McpImportStore,
} from "@/lib/mcp/import-transactions"
import {
  addTransactionTool,
  listAccountsTool,
  signedAmount,
  type McpAccount,
  type McpCategory,
  type McpPlanContext,
  type McpTransaction,
} from "@/lib/mcp/tools"

const account: McpAccount = { id: "acc-1", nombre: "Efectivo", saldo: 100, currency: "EUR" }
const otherAccount: McpAccount = { id: "acc-2", nombre: "Banco", saldo: 50, currency: "EUR" }
const comida: McpCategory = { id: "cat-1", name: "Comida", kind: "gasto" }
const nomina: McpCategory = { id: "cat-2", name: "Nómina", kind: "ingreso" }
const ambas: McpCategory = { id: "cat-3", name: "Otros", kind: "both" }

const USER = "00000000-0000-4000-8000-000000000001"
const OTHER = "00000000-0000-4000-8000-000000000002"

function memoryImportStore(init?: {
  accounts?: McpAccount[]
  categories?: McpCategory[]
  transactions?: Array<McpTransaction & { tags?: string[] }>
  plan?: McpPlanContext
}): McpImportStore & { accounts: McpAccount[]; transactions: Array<McpTransaction & { tags?: string[] }>; previews: McpImportPreviewRecord[] } {
  const accounts = (init?.accounts ?? [account, otherAccount]).map((item) => ({ ...item }))
  const categories = (init?.categories ?? [comida, nomina, ambas]).map((item) => ({ ...item }))
  const transactions = [...(init?.transactions ?? [])]
  const previews: McpImportPreviewRecord[] = []
  const plan: McpPlanContext = init?.plan ?? {
    plan: "pro",
    paymentsEnabled: true,
    source: null,
    accountCount: accounts.length,
    goalCount: 0,
  }
  const store: McpImportStore & { accounts: McpAccount[]; transactions: Array<McpTransaction & { tags?: string[] }>; previews: McpImportPreviewRecord[] } = {
    accounts,
    transactions,
    previews,
    async listAccounts() { return accounts.map((item) => ({ ...item })) },
    async listCategories() { return categories.map((item) => ({ ...item })) },
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
      const created: McpTransaction & { tags?: string[] } = {
        id: `tx-${transactions.length + 1}`,
        cuenta_id: input.account.id,
        monto: input.monto,
        fecha: input.fecha,
        tipo: input.tipo,
        categoria: input.category.name,
        descripcion: input.descripcion,
        created_at: "2026-11-28T12:00:00.000Z",
        tags: ["mcp"],
      }
      transactions.push(created)
      const target = accounts.find((item) => item.id === input.account.id)
      if (target) target.saldo = Math.round((target.saldo + signedAmount(input.tipo, input.monto)) * 100) / 100
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
        tags: row.tags ?? [],
      }))
    },
    async listDuplicateCandidates(_userId, fechas) {
      const set = new Set(fechas)
      return transactions
        .filter((row) => set.has(row.fecha))
        .map((row) => ({
          id: row.id,
          cuenta_id: row.cuenta_id,
          monto: row.monto,
          fecha: row.fecha,
          descripcion: row.descripcion,
        }))
    },
    async countRecentImports(_userId, sinceIso) {
      return previews.filter((row) => row.usedAt && row.usedAt >= sinceIso).length
    },
    async saveImportPreview(row) {
      previews.push({ ...row, payload: { ...row.payload, rows: [...row.payload.rows] } })
    },
    async getImportPreview(tokenHash) {
      const row = previews.find((item) => item.tokenHash === tokenHash)
      return row ? { ...row } : null
    },
    async importFromToken(userId, tokenHash, now = new Date()) {
      const row = previews.find((item) => item.tokenHash === tokenHash)
      if (!row || row.userId !== userId) return { ok: false, status: 404, error: "import_token no es válido" }
      if (row.usedAt && row.result) return { ok: true, data: { ...row.result, idempotent: true } }
      if (new Date(row.expiresAt).getTime() <= now.getTime()) {
        return { ok: false, status: 400, error: "import_token ha caducado" }
      }
      const created: McpTransaction[] = []
      for (const item of row.payload.rows) {
        const createdAt = now.toISOString()
        const tx: McpTransaction & { tags?: string[] } = {
          id: `imp-${transactions.length + 1}`,
          cuenta_id: item.cuenta_id,
          monto: item.monto,
          fecha: item.fecha,
          tipo: item.tipo,
          categoria: item.categoria,
          descripcion: item.descripcion,
          created_at: createdAt,
          tags: ["mcp", `import:${row.importBatchId}`],
        }
        transactions.push(tx)
        created.push(tx)
        const target = accounts.find((acc) => acc.id === item.cuenta_id)
        if (target) target.saldo = Math.round((target.saldo + signedAmount(item.tipo, item.monto)) * 100) / 100
      }
      const result = {
        imported: created.length,
        skipped_duplicates: row.payload.skipped_duplicates,
        batch_id: row.importBatchId,
        transactions: created,
      }
      row.usedAt = now.toISOString()
      row.result = result
      return { ok: true, data: { ...result, idempotent: false } }
    },
  }
  return store
}

const now = new Date("2026-11-28T12:00:00+01:00")

describe("validación del lote", () => {
  it("parsea importes europeos y fechas DD/MM/YYYY, y rechaza nulos o no finitos", () => {
    expect(parseImportAmount(-12.5)).toBe(-12.5)
    expect(parseImportAmount("12,50")).toBe(12.5)
    expect(parseImportAmount("1.234,56")).toBe(1234.56)
    expect(parseImportAmount(0)).toBeNull()
    expect(parseImportAmount(Infinity)).toBeNull()
    expect(parseImportAmount(null)).toBeNull()
    expect(parseImportDate("2026-11-01")).toBe("2026-11-01")
    expect(parseImportDate("01/11/2026")).toBe("2026-11-01")
    expect(parseImportDate("31/02/2026")).toBeNull()
  })

  it("considera similares descripciones equivalentes o contenidas", () => {
    expect(descriptionsAreSimilar("Café  con leche", "café con leche")).toBe(true)
    expect(descriptionsAreSimilar("Café con leche grande", "Café con leche")).toBe(true)
    expect(descriptionsAreSimilar("Taxi", "Supermercado")).toBe(false)
  })

  it("rechaza filas inválidas sin crear cuentas ni categorías, y asigna las existentes", async () => {
    const store = memoryImportStore()
    const preview = await previewImportTransactionsTool(store, USER, {
      rows: [
        { date: "2026-11-20", amount: 12.5, account: "Efectivo", category: "Comida", type: "gasto", description: "Pan" },
        { date: "2026-11-20", amount: 900, account: "Cuenta inventada", category: "Comida", type: "gasto" },
        { date: "2026-11-20", amount: 10, account: "Efectivo", category: "Nueva cat", type: "gasto" },
        { date: "1990-01-01", amount: 10, account: "Efectivo", category: "Comida", type: "gasto" },
        { date: "2026-11-20", amount: 0, account: "Efectivo", category: "Comida", type: "gasto" },
        { date: "2026-11-21", amount: 2000, account: "Efectivo", category: "Nómina", type: "ingreso", description: "Nómina nov" },
      ],
    }, now)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(store.transactions).toHaveLength(0)
    expect(store.accounts[0].saldo).toBe(100)
    expect(preview.data.summary.valid).toBe(2)
    expect(preview.data.summary.invalid).toBe(4)
    expect(preview.data.summary.to_import).toBe(2)
    expect(preview.data.summary.income).toBe(2000)
    expect(preview.data.summary.expenses).toBe(12.5)
    expect(preview.data.errors.map((item) => item.index)).toEqual([1, 2, 3, 4])
    expect(preview.data.sample[0]).toMatchObject({ account: "Efectivo", category: "Comida", amount: 12.5 })
  })

  it("infiere el tipo por el signo o la categoría, y exige type si la categoría es ambas", async () => {
    const store = memoryImportStore()
    const preview = await previewImportTransactionsTool(store, USER, {
      rows: [
        { date: "20/11/2026", amount: "-8,40", account: "Efectivo", category: "Comida", description: "Bar" },
        { date: "2026-11-20", amount: 1500, account: "Efectivo", category: "Nómina" },
        { date: "2026-11-20", amount: 5, account: "Efectivo", category: "Otros" },
      ],
    }, now)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.data.summary.to_import).toBe(2)
    expect(preview.data.sample.map((row) => row.type)).toEqual(["gasto", "ingreso"])
    expect(preview.data.errors).toEqual([{ index: 2, error: "type debe ser gasto o ingreso" }])
  })

  it("acepta 500 filas y rechaza 501 con un mensaje para partir el Excel en lotes", async () => {
    const store = memoryImportStore()
    const row = { date: "2026-11-20", amount: 1, account: "Efectivo", category: "Comida", type: "gasto" }
    const accepted = await previewImportTransactionsTool(store, USER, { rows: Array.from({ length: 500 }, () => ({ ...row })) }, now)
    expect(accepted.ok).toBe(true)
    if (accepted.ok) {
      expect(accepted.data.summary.total_rows).toBe(500)
      expect(accepted.data.summary.to_import).toBe(1)
      expect(accepted.data.summary.duplicates).toBe(499)
    }

    const rejected = await previewImportTransactionsTool(store, USER, { rows: Array.from({ length: 501 }, () => ({ ...row })) }, now)
    expect(rejected).toEqual({ ok: false, status: 400, error: importRowLimitError() })
    expect(importRowLimitError()).toContain("500")
    expect(importRowLimitError()).toMatch(/pártelas tú en lotes/i)
    expect(importRowLimitError()).toMatch(/por meses/i)
    expect(importRowLimitError()).toMatch(/avísale de cuántos lotes/i)
    expect(store.previews).toHaveLength(1)
  })
})

describe("duplicados", () => {
  it("marca repetidos del lote y los que ya están en la base con descripción similar", async () => {
    const store = memoryImportStore({
      transactions: [{
        id: "tx-old",
        cuenta_id: "acc-1",
        monto: 12.5,
        fecha: "2026-11-20",
        tipo: "gasto",
        categoria: "Comida",
        descripcion: "Café con leche",
        created_at: "2026-11-20T10:00:00.000Z",
      }],
    })
    const preview = await previewImportTransactionsTool(store, USER, {
      rows: [
        { date: "2026-11-20", amount: 12.5, account: "Efectivo", category: "Comida", type: "gasto", description: "café con leche" },
        { date: "2026-11-21", amount: 9, account: "Efectivo", category: "Comida", type: "gasto", description: "Taxi" },
        { date: "2026-11-21", amount: 9, account: "Efectivo", category: "Comida", type: "gasto", description: "Taxi  " },
        { date: "2026-11-21", amount: 9, account: "Banco", category: "Comida", type: "gasto", description: "Taxi" },
      ],
    }, now)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.data.duplicates).toEqual([
      { index: 0, reason: "Ya existe un movimiento similar en Garra", existing_id: "tx-old" },
      { index: 2, reason: "Duplicado dentro del lote" },
    ])
    expect(preview.data.summary.to_import).toBe(2)
    expect(preview.data.summary.duplicates).toBe(2)
  })
})

describe("importación e idempotencia", () => {
  it("exige confirm=true, inserta, actualiza saldos como add_transaction y no reimporta el mismo token", async () => {
    const store = memoryImportStore()
    const preview = await previewImportTransactionsTool(store, USER, {
      rows: [
        { date: "2026-11-20", amount: 12.5, account: "Efectivo", category: "Comida", type: "gasto", description: "Pan" },
        { date: "2026-11-21", amount: 200, account: "Efectivo", category: "Nómina", type: "ingreso", description: "Plus" },
      ],
    }, now)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(store.transactions).toHaveLength(0)

    const denied = await importTransactionsTool(store, USER, { import_token: preview.data.import_token, confirm: false }, now)
    expect(denied.ok).toBe(false)
    expect(store.transactions).toHaveLength(0)

    const first = await importTransactionsTool(store, USER, { import_token: preview.data.import_token, confirm: true }, now)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.data.imported).toBe(2)
    expect(first.data.idempotent).toBe(false)
    expect(store.transactions).toHaveLength(2)
    expect(store.transactions.every((row) => row.tags?.includes(`import:${first.data.batch_id}`))).toBe(true)
    expect(store.accounts.find((item) => item.id === "acc-1")?.saldo).toBe(287.5)

    const viaAdd = memoryImportStore()
    await addTransactionTool(viaAdd, USER, { tipo: "gasto", monto: 12.5, cuenta: "Efectivo", categoria: "Comida", fecha: "2026-11-20", nota: "Pan" }, now)
    await addTransactionTool(viaAdd, USER, { tipo: "ingreso", monto: 200, cuenta: "Efectivo", categoria: "Nómina", fecha: "2026-11-21", nota: "Plus" }, now)
    expect(store.accounts[0].saldo).toBe(viaAdd.accounts[0].saldo)

    const second = await importTransactionsTool(store, USER, { import_token: preview.data.import_token, confirm: true }, now)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.data.idempotent).toBe(true)
    expect(second.data.imported).toBe(2)
    expect(store.transactions).toHaveLength(2)
    expect(store.accounts.find((item) => item.id === "acc-1")?.saldo).toBe(287.5)
  })

  it("no deja usar el token de otro usuario y no mezcla sus movimientos", async () => {
    const store = memoryImportStore()
    const preview = await previewImportTransactionsTool(store, USER, {
      rows: [{ date: "2026-11-20", amount: 5, account: "Efectivo", category: "Comida", type: "gasto", description: "Solo mío" }],
    }, now)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    const stolen = await importTransactionsTool(store, OTHER, { import_token: preview.data.import_token, confirm: true }, now)
    expect(stolen).toEqual({ ok: false, status: 404, error: "import_token no es válido" })
    expect(store.transactions).toHaveLength(0)

    const ok = await importTransactionsTool(store, USER, { import_token: preview.data.import_token, confirm: true }, now)
    expect(ok.ok).toBe(true)
    expect(store.transactions).toHaveLength(1)
  })

  it("rechaza un token caducado y respeta el límite diario de 10 lotes", async () => {
    const store = memoryImportStore()
    const preview = await previewImportTransactionsTool(store, USER, {
      rows: [{ date: "2026-11-20", amount: 5, account: "Efectivo", category: "Comida", type: "gasto" }],
    }, now)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    const expired = await importTransactionsTool(
      store,
      USER,
      { import_token: preview.data.import_token, confirm: true },
      new Date("2026-11-28T12:20:00+01:00"),
    )
    expect(expired).toEqual({ ok: false, status: 400, error: "import_token ha caducado" })
    expect(store.transactions).toHaveLength(0)

    for (let i = 0; i < 10; i++) {
      const item = await previewImportTransactionsTool(store, USER, {
        rows: [{ date: "2026-11-22", amount: 1 + i, account: "Efectivo", category: "Comida", type: "gasto", description: `n${i}` }],
      }, now)
      expect(item.ok).toBe(true)
      if (!item.ok) return
      const imported = await importTransactionsTool(store, USER, { import_token: item.data.import_token, confirm: true }, now)
      expect(imported.ok).toBe(true)
    }
    const blocked = await previewImportTransactionsTool(store, USER, {
      rows: [{ date: "2026-11-23", amount: 3, account: "Efectivo", category: "Comida", type: "gasto" }],
    }, now)
    expect(blocked).toEqual({ ok: false, status: 400, error: "has alcanzado el límite de 10 lotes importados en 24 horas" })
  })
})

describe("las herramientas actuales siguen igual", () => {
  it("sigue apuntando un movimiento suelto", async () => {
    const store = memoryImportStore()
    const added = await addTransactionTool(store, USER, {
      tipo: "gasto",
      monto: 4,
      cuenta: "Efectivo",
      categoria: "Comida",
      fecha: "2026-11-25",
    })
    expect(added.ok).toBe(true)
    const accounts = await listAccountsTool(store, USER)
    expect(accounts.ok && accounts.data.find((item) => item.id === "acc-1")?.saldo).toBe(96)
  })
})
