import { describe, expect, it } from "vitest"
import { createGarraMcpHandler } from "@/lib/mcp/handler"
import { generateMcpToken, hashMcpToken } from "@/lib/mcp/token"
import { signedAmount, type McpAccount, type McpCategory, type McpStore, type McpTransaction } from "@/lib/mcp/tools"

const TEST_USER = "00000000-0000-4000-8000-000000000001"
const FOREIGN_USER = "00000000-0000-4000-8000-000000000002"

type TokenRow = { hash: string; userId: string; revoked: boolean }

function testStore(): McpStore & { accounts: McpAccount[]; transactions: McpTransaction[] } {
  const accounts: McpAccount[] = [
    { id: "acc-1", nombre: "Efectivo", saldo: 80, currency: "EUR" },
  ]
  const categories: McpCategory[] = [
    { id: "cat-1", name: "Comida", kind: "gasto" },
    { id: "cat-2", name: "Nómina", kind: "ingreso" },
  ]
  const transactions: McpTransaction[] = []
  return {
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
    async getPlan() {
      return { plan: "free", paymentsEnabled: true, source: null, accountCount: accounts.length, goalCount: 0 }
    },
    async insertTransaction(_userId, input) {
      const created: McpTransaction = {
        id: crypto.randomUUID(),
        cuenta_id: input.account.id,
        monto: input.monto,
        fecha: input.fecha,
        tipo: input.tipo,
        categoria: input.category.name,
        descripcion: input.descripcion,
        created_at: new Date().toISOString(),
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
}

async function parseMcpResponse(response: Response): Promise<Record<string, unknown>> {
  const type = response.headers.get("content-type") ?? ""
  const body = await response.text()
  if (type.includes("text/event-stream")) {
    const lines = body.split("\n").filter((line) => line.startsWith("data:"))
    const last = lines.at(-1)?.slice(5).trim()
    if (!last) throw new Error(`SSE vacío: ${body}`)
    return JSON.parse(last) as Record<string, unknown>
  }
  return JSON.parse(body) as Record<string, unknown>
}

describe("endpoint MCP local (usuario de prueba, sin datos reales)", () => {
  const tokens: TokenRow[] = []
  const live = generateMcpToken()
  const revoked = generateMcpToken()
  tokens.push({ hash: hashMcpToken(live), userId: TEST_USER, revoked: false })
  tokens.push({ hash: hashMcpToken(revoked), userId: TEST_USER, revoked: true })

  const store = testStore()
  const handler = createGarraMcpHandler(store, async (token) => {
    const row = tokens.find((item) => item.hash === hashMcpToken(token))
    if (!row || row.revoked) return null
    return { userId: row.userId }
  })

  function call(token: string | null, payload: unknown) {
    const headers: Record<string, string> = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    }
    if (token) headers.Authorization = `Bearer ${token}`
    return handler(new Request("http://garra.test/api/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }))
  }

  it("rechaza una petición sin token, con token inventado o revocado", async () => {
    const missing = await call(null, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } })
    expect(missing.status).toBe(401)
    expect(missing.headers.get("www-authenticate") ?? "").toMatch(/resource_metadata=.*oauth-protected-resource/)
    const unknown = await call("grr_token-inventado-con-suficiente-longitud-123456", { jsonrpc: "2.0", id: 1, method: "ping" })
    expect(unknown.status).toBe(401)
    const closed = await call(revoked, { jsonrpc: "2.0", id: 1, method: "ping" })
    expect(closed.status).toBe(401)
  })

  it("inicializa, lista cuentas y apunta un gasto del usuario de prueba", async () => {
    const init = await call(live, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "garra-test", version: "1.0" },
      },
    })
    expect(init.status).toBe(200)
    const initBody = await parseMcpResponse(init)
    expect(initBody).toHaveProperty("result")

    const accounts = await call(live, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_accounts", arguments: {} },
    })
    expect(accounts.status).toBe(200)
    const accountsBody = await parseMcpResponse(accounts)
    const accountText = JSON.stringify(accountsBody)
    expect(accountText).toContain("Efectivo")
    expect(accountText).not.toContain(FOREIGN_USER)

    const added = await call(live, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "add_transaction",
        arguments: {
          tipo: "gasto",
          monto: 6.5,
          cuenta: "Efectivo",
          categoria: "Comida",
          fecha: "2026-11-25",
          nota: "Prueba local",
        },
      },
    })
    expect(added.status).toBe(200)
    const addedBody = await parseMcpResponse(added)
    expect(JSON.stringify(addedBody)).toContain("Prueba local")
    expect(store.transactions).toHaveLength(1)
    expect(store.transactions[0].descripcion).toBe("Prueba local")
    expect(store.accounts[0].saldo).toBe(73.5)
  })

  it("lista las 5 herramientas, incluida get_monthly_summary, y se anuncia como Garra", async () => {
    const init = await call(live, {
      jsonrpc: "2.0",
      id: 10,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "garra-test", version: "1.0" } },
    })
    expect(init.status).toBe(200)
    const initBody = await parseMcpResponse(init)
    const info = JSON.stringify(initBody)
    expect(info).toContain("Garra")

    const listed = await call(live, { jsonrpc: "2.0", id: 11, method: "tools/list", params: {} })
    expect(listed.status).toBe(200)
    const body = await parseMcpResponse(listed)
    const names = JSON.stringify(body)
    for (const tool of ["list_accounts", "list_categories", "list_recent_transactions", "add_transaction", "get_monthly_summary"]) {
      expect(names).toContain(tool)
    }
    const matches = names.match(/"name":"(list_accounts|list_categories|list_recent_transactions|add_transaction|get_monthly_summary)"/g) ?? []
    expect(new Set(matches).size).toBe(5)
  })
})
