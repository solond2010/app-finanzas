// Lógica de las herramientas MCP, independiente del transporte HTTP.
// add_transaction inserta el movimiento y mueve accounts.saldo con un delta
// atómico (CAS), igual que el arreglo del fallo 2 y el Atajo. No recalcula
// el saldo a partir del ledger ni usa trigger de reconciliación.

import { dateKeyInTimeZone, isDateKey } from "@/lib/date-utils"
import { canHaveAccounts, canHaveGoals, type Plan } from "@/lib/billing/plans"

export const MCP_TAG = "mcp"
export const MAX_RECENT = 50
export const DEFAULT_RECENT = 10
export const MAX_NOTE_LENGTH = 500
export const MAX_AMOUNT = 1_000_000

export type McpTipo = "gasto" | "ingreso"

export type McpAccount = {
  id: string
  nombre: string
  saldo: number
  currency: string | null
}

export type McpCategory = {
  id: string
  name: string
  kind: string | null
}

export type McpTransaction = {
  id: string
  cuenta_id: string
  monto: number
  fecha: string
  tipo: McpTipo
  categoria: string
  descripcion: string
  created_at: string
}

export type McpPlanContext = {
  plan: Plan
  paymentsEnabled: boolean
  source?: string | null
  accountCount: number
  goalCount: number
}

export type AddTransactionInput = {
  tipo: McpTipo
  monto: number
  account: McpAccount
  category: McpCategory
  fecha: string
  descripcion: string
}

export type ToolError = { ok: false; status: 400 | 403 | 404 | 409; error: string }
export type ToolOk<T> = { ok: true; data: T }
export type ToolResult<T> = ToolOk<T> | ToolError

export type McpStore = {
  listAccounts(userId: string): Promise<McpAccount[]>
  listCategories(userId: string): Promise<McpCategory[]>
  findAccount(userId: string, idOrName: string): Promise<McpAccount | null>
  findCategory(userId: string, idOrName: string): Promise<McpCategory | null>
  getPlan(userId: string): Promise<McpPlanContext>
  insertTransaction(userId: string, input: AddTransactionInput): Promise<McpTransaction>
  listRecentTransactions(userId: string, limit: number): Promise<McpTransaction[]>
}

export function signedAmount(tipo: McpTipo, monto: number): number {
  return tipo === "ingreso" ? monto : -monto
}

export function ledgerSaldo(transactions: Array<{ tipo: string; monto: number }>): number {
  return transactions.reduce((sum, t) => sum + (t.tipo === "ingreso" ? t.monto : -t.monto), 0)
}

export function parseMonto(value: unknown): number | null {
  const raw = typeof value === "string" ? value.trim().replace(",", ".") : value
  const monto = typeof raw === "number" ? raw : typeof raw === "string" && raw !== "" ? Number(raw) : NaN
  if (!Number.isFinite(monto) || monto <= 0 || monto > MAX_AMOUNT) return null
  return Math.round(monto * 100) / 100
}

export function parseFecha(value: unknown, now = new Date()): string | null {
  if (value === undefined || value === null || value === "") {
    return dateKeyInTimeZone(now, "Europe/Madrid")
  }
  if (typeof value !== "string" || !isDateKey(value)) return null
  return value
}

export function parseNota(value: unknown): string | null {
  if (value === undefined || value === null) return ""
  if (typeof value !== "string") return null
  const nota = value.trim()
  if (nota.length > MAX_NOTE_LENGTH) return null
  return nota
}

export function parseTipo(value: unknown): McpTipo | null {
  return value === "gasto" || value === "ingreso" ? value : null
}

export function parseLimit(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return DEFAULT_RECENT
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  if (!Number.isInteger(n) || n < 1 || n > MAX_RECENT) return null
  return n
}

export function categoryMatchesTipo(category: McpCategory, tipo: McpTipo): boolean {
  const kind = (category.kind ?? "both").toLowerCase()
  return kind === "both" || kind === tipo
}

/** Las herramientas de esta fase no crean cuentas ni metas; se deja
 *  documentado el criterio para cuando existan esas herramientas. */
export function canCreateAccountForPlan(plan: McpPlanContext): boolean {
  return canHaveAccounts(plan.plan, plan.paymentsEnabled, plan.accountCount + 1, plan.source)
}

export function canCreateGoalForPlan(plan: McpPlanContext): boolean {
  return canHaveGoals(plan.plan, plan.paymentsEnabled, plan.goalCount + 1, plan.source)
}

export async function listAccountsTool(store: McpStore, userId: string): Promise<ToolResult<McpAccount[]>> {
  const accounts = await store.listAccounts(userId)
  return { ok: true, data: accounts }
}

export async function listCategoriesTool(store: McpStore, userId: string): Promise<ToolResult<McpCategory[]>> {
  const categories = await store.listCategories(userId)
  return { ok: true, data: categories }
}

export async function listRecentTransactionsTool(
  store: McpStore,
  userId: string,
  args: { limit?: unknown },
): Promise<ToolResult<McpTransaction[]>> {
  const limit = parseLimit(args.limit)
  if (limit === null) return { ok: false, status: 400, error: `limit debe ser un entero entre 1 y ${MAX_RECENT}` }
  const rows = await store.listRecentTransactions(userId, limit)
  return { ok: true, data: rows }
}

export async function addTransactionTool(
  store: McpStore,
  userId: string,
  args: Record<string, unknown>,
  now = new Date(),
): Promise<ToolResult<McpTransaction>> {
  const tipo = parseTipo(args.tipo)
  if (!tipo) return { ok: false, status: 400, error: "tipo debe ser gasto o ingreso" }

  const monto = parseMonto(args.monto)
  if (monto === null) return { ok: false, status: 400, error: "monto debe ser un número mayor que 0" }

  const cuentaRef = typeof args.cuenta === "string" && args.cuenta.trim()
    ? args.cuenta.trim()
    : typeof args.cuenta_id === "string" && args.cuenta_id.trim()
      ? args.cuenta_id.trim()
      : ""
  if (!cuentaRef) return { ok: false, status: 400, error: "cuenta es obligatoria" }

  const categoriaRef = typeof args.categoria === "string" && args.categoria.trim()
    ? args.categoria.trim()
    : typeof args.categoria_id === "string" && args.categoria_id.trim()
      ? args.categoria_id.trim()
      : ""
  if (!categoriaRef) return { ok: false, status: 400, error: "categoria es obligatoria" }

  const fecha = parseFecha(args.fecha, now)
  if (!fecha) return { ok: false, status: 400, error: "fecha debe ser una fecha válida con formato YYYY-MM-DD" }

  const descripcion = parseNota(args.nota ?? args.descripcion)
  if (descripcion === null) return { ok: false, status: 400, error: `la nota no puede superar ${MAX_NOTE_LENGTH} caracteres` }

  const account = await store.findAccount(userId, cuentaRef)
  if (!account) return { ok: false, status: 400, error: "La cuenta no existe" }

  const category = await store.findCategory(userId, categoriaRef)
  if (!category) return { ok: false, status: 400, error: "La categoría no existe" }
  if (!categoryMatchesTipo(category, tipo)) {
    return { ok: false, status: 400, error: "La categoría no corresponde al tipo de movimiento" }
  }

  const created = await store.insertTransaction(userId, {
    tipo,
    monto,
    account,
    category,
    fecha,
    descripcion,
  })
  return { ok: true, data: created }
}

export function toolResultText<T>(result: ToolResult<T>): { isError: boolean; text: string } {
  if (!result.ok) return { isError: true, text: result.error }
  return { isError: false, text: JSON.stringify(result.data, null, 2) }
}
