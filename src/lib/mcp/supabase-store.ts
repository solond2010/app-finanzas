import "server-only"

import { supabaseServer } from "@/lib/supabase-server"
import { getUserPlan, getUserPlanRow, paymentsEnabled } from "@/lib/server/billing"
import { applySaldoDelta } from "@/lib/server/saldo-delta"
import { MCP_TAG, signedAmount, type AddTransactionInput, type McpAccount, type McpCashFlowTx, type McpCategory, type McpPlanContext, type McpStore, type McpTransaction } from "@/lib/mcp/tools"

function asAccount(row: { id: string; nombre: string; saldo: number | string; currency: string | null }): McpAccount {
  return { id: row.id, nombre: row.nombre, saldo: Number(row.saldo), currency: row.currency }
}

function asCategory(row: { id: string; name: string; kind: string | null }): McpCategory {
  return { id: row.id, name: row.name, kind: row.kind }
}

function asTransaction(row: {
  id: string
  cuenta_id: string
  monto: number | string
  fecha: string
  tipo: "gasto" | "ingreso"
  categoria: string
  descripcion: string | null
  created_at: string | null
}): McpTransaction {
  return {
    id: row.id,
    cuenta_id: row.cuenta_id,
    monto: Number(row.monto),
    fecha: row.fecha,
    tipo: row.tipo,
    categoria: row.categoria,
    descripcion: row.descripcion ?? "",
    created_at: row.created_at ?? "",
  }
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase("es")
}

export const supabaseMcpStore: McpStore = {
  async listAccounts(userId) {
    const { data, error } = await supabaseServer
      .from("accounts")
      .select("id, nombre, saldo, currency")
      .eq("user_id", userId)
      .order("nombre", { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => asAccount(row as never))
  },

  async listCategories(userId) {
    const { data, error } = await supabaseServer
      .from("categories")
      .select("id, name, kind")
      .eq("user_id", userId)
      .order("name", { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => asCategory(row as never))
  },

  async findAccount(userId, idOrName) {
    const byId = await supabaseServer
      .from("accounts")
      .select("id, nombre, saldo, currency")
      .eq("user_id", userId)
      .eq("id", idOrName)
      .maybeSingle()
    if (byId.error) throw new Error(byId.error.message)
    if (byId.data) return asAccount(byId.data as never)

    const { data, error } = await supabaseServer
      .from("accounts")
      .select("id, nombre, saldo, currency")
      .eq("user_id", userId)
    if (error) throw new Error(error.message)
    const matches = (data ?? []).filter((row) => normalizeName((row as { nombre: string }).nombre) === normalizeName(idOrName))
    return matches.length === 1 ? asAccount(matches[0] as never) : null
  },

  async findCategory(userId, idOrName) {
    const byId = await supabaseServer
      .from("categories")
      .select("id, name, kind")
      .eq("user_id", userId)
      .eq("id", idOrName)
      .maybeSingle()
    if (byId.error) throw new Error(byId.error.message)
    if (byId.data) return asCategory(byId.data as never)

    const { data, error } = await supabaseServer
      .from("categories")
      .select("id, name, kind")
      .eq("user_id", userId)
    if (error) throw new Error(error.message)
    const matches = (data ?? []).filter((row) => normalizeName((row as { name: string }).name) === normalizeName(idOrName))
    return matches.length === 1 ? asCategory(matches[0] as never) : null
  },

  async getPlan(userId) {
    const [plan, row, accounts, funds] = await Promise.all([
      getUserPlan(userId),
      getUserPlanRow(userId),
      supabaseServer.from("accounts").select("id").eq("user_id", userId),
      supabaseServer.from("sinking_funds").select("id").eq("user_id", userId),
    ])
    if (accounts.error) throw new Error(accounts.error.message)
    if (funds.error) throw new Error(funds.error.message)
    const context: McpPlanContext = {
      plan,
      paymentsEnabled: paymentsEnabled(),
      source: row?.source ?? null,
      accountCount: accounts.data?.length ?? 0,
      goalCount: funds.data?.length ?? 0,
    }
    return context
  },

  async insertTransaction(userId, input: AddTransactionInput) {
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const { error: insertError } = await supabaseServer.from("transactions").insert({
      id,
      cuenta_id: input.account.id,
      monto: input.monto,
      fecha: input.fecha,
      tipo: input.tipo,
      categoria: input.category.name,
      es_necesidad: false,
      descripcion: input.descripcion,
      tags: [MCP_TAG],
      user_id: userId,
      created_at: createdAt,
    })
    if (insertError) throw new Error(insertError.message)

    const delta = signedAmount(input.tipo, input.monto)
    try {
      await applySaldoDelta(supabaseServer, userId, input.account.id, delta)
    } catch (error) {
      await supabaseServer.from("transactions").delete().eq("user_id", userId).eq("id", id)
      throw new Error(error instanceof Error ? error.message : "No se pudo actualizar el saldo")
    }

    return {
      id,
      cuenta_id: input.account.id,
      monto: input.monto,
      fecha: input.fecha,
      tipo: input.tipo,
      categoria: input.category.name,
      descripcion: input.descripcion,
      created_at: createdAt,
    }
  },

  async listRecentTransactions(userId, limit) {
    const { data, error } = await supabaseServer
      .from("transactions")
      .select("id, cuenta_id, monto, fecha, tipo, categoria, descripcion, created_at")
      .eq("user_id", userId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => asTransaction(row as never))
  },

  async listCashFlowTransactions(userId) {
    const { data, error } = await supabaseServer
      .from("transactions")
      .select("id, cuenta_id, monto, fecha, tipo, categoria, tags")
      .eq("user_id", userId)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => {
      const item = row as {
        id: string
        cuenta_id: string
        monto: number | string
        fecha: string
        tipo: string
        categoria?: string | null
        tags?: string[] | null
      }
      const cash: McpCashFlowTx = {
        id: item.id,
        cuenta_id: item.cuenta_id,
        monto: Number(item.monto),
        fecha: item.fecha,
        tipo: item.tipo,
        categoria: item.categoria ?? "",
        tags: Array.isArray(item.tags) ? item.tags : [],
      }
      return cash
    })
  },
}
