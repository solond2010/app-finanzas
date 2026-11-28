// Vista previa e importación de movimientos por lote (Excel vía ChatGPT).
// La vista previa es solo lectura. La importación solo inserta, nunca edita ni borra.

import { createHash, randomBytes } from "crypto"
import { dateKeyInTimeZone, isDateKey } from "@/lib/date-utils"
import {
  MAX_AMOUNT,
  MAX_NOTE_LENGTH,
  categoryMatchesTipo,
  parseNota,
  parseTipo,
  signedAmount,
  type McpAccount,
  type McpCategory,
  type McpStore,
  type McpTipo,
  type McpTransaction,
  type ToolResult,
} from "@/lib/mcp/tools"

export const IMPORT_TOKEN_PREFIX = "gim_"
export const MAX_IMPORT_ROWS = 200
export const MAX_IMPORTS_PER_DAY = 10
export const IMPORT_TOKEN_TTL_SECONDS = 15 * 60
export const IMPORT_SAMPLE_SIZE = 10
export const IMPORT_MIN_YEARS_BACK = 15
export const IMPORT_MAX_DAYS_FORWARD = 366

export type ImportRowInput = {
  date?: unknown
  amount?: unknown
  description?: unknown
  account?: unknown
  category?: unknown
  type?: unknown
  fecha?: unknown
  monto?: unknown
  descripcion?: unknown
  cuenta?: unknown
  categoria?: unknown
  tipo?: unknown
}

export type PreparedImportRow = {
  index: number
  fecha: string
  monto: number
  tipo: McpTipo
  descripcion: string
  account: McpAccount
  category: McpCategory
}

export type ImportIssue = {
  index: number
  error: string
}

export type ImportDuplicate = {
  index: number
  reason: string
  existing_id?: string
}

export type ImportPreviewPayload = {
  rows: Array<{
    cuenta_id: string
    monto: number
    fecha: string
    tipo: McpTipo
    categoria: string
    descripcion: string
  }>
  skipped_duplicates: number
  rows_hash: string
}

export type McpImportPreviewRecord = {
  tokenHash: string
  userId: string
  rowsHash: string
  payload: ImportPreviewPayload
  importBatchId: string
  createdAt: string
  expiresAt: string
  usedAt: string | null
  result: ImportCommitResult | null
}

export type ImportCommitResult = {
  imported: number
  skipped_duplicates: number
  batch_id: string
  transactions: McpTransaction[]
}

export type DuplicateCandidate = {
  id: string
  cuenta_id: string
  monto: number
  fecha: string
  descripcion: string
}

export type McpImportStore = McpStore & {
  listDuplicateCandidates(userId: string, fechas: string[]): Promise<DuplicateCandidate[]>
  countRecentImports(userId: string, sinceIso: string): Promise<number>
  saveImportPreview(row: McpImportPreviewRecord): Promise<void>
  getImportPreview(tokenHash: string): Promise<McpImportPreviewRecord | null>
  importFromToken(userId: string, tokenHash: string, now?: Date): Promise<ToolResult<ImportCommitResult & { idempotent?: boolean }>>
}

export function newImportToken(): string {
  return IMPORT_TOKEN_PREFIX + randomBytes(24).toString("base64url")
}

export function hashImportToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function hashImportRows(rows: unknown): string {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex")
}

export function isImportStore(store: McpStore): store is McpImportStore {
  return (
    typeof (store as McpImportStore).saveImportPreview === "function" &&
    typeof (store as McpImportStore).importFromToken === "function"
  )
}

export function normalizeImportText(value: string): string {
  return value.trim().toLocaleLowerCase("es").replace(/\s+/g, " ")
}

export function descriptionsAreSimilar(left: string, right: string): boolean {
  const a = normalizeImportText(left)
  const b = normalizeImportText(right)
  if (a === b) return true
  if (!a || !b) return false
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length >= 4 && long.includes(short)
}

export function parseImportAmount(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value === 0) return null
    const rounded = Math.round(Math.abs(value) * 100) / 100
    if (rounded <= 0 || rounded > MAX_AMOUNT) return null
    return value < 0 ? -rounded : rounded
  }
  if (typeof value !== "string") return null
  const raw = value.trim().replace(/\s/g, "").replace(/€/g, "")
  if (!raw) return null
  let normalized = raw
  const lastComma = raw.lastIndexOf(",")
  const lastDot = raw.lastIndexOf(".")
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "")
  } else if (lastComma >= 0) {
    const decimals = raw.length - lastComma - 1
    normalized = decimals === 3 && /^\d{1,3}$/.test(raw.slice(lastComma + 1))
      ? raw.replace(",", "")
      : raw.replace(",", ".")
  }
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount === 0) return null
  const rounded = Math.round(Math.abs(amount) * 100) / 100
  if (rounded <= 0 || rounded > MAX_AMOUNT) return null
  return amount < 0 ? -rounded : rounded
}

export function parseImportDate(value: unknown, now = new Date()): string | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (isDateKey(raw)) return raw
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  return isDateKey(iso) ? iso : null
}

export function importDateBounds(now = new Date()): { min: string; max: string } {
  const today = dateKeyInTimeZone(now, "Europe/Madrid")
  const year = Number(today.slice(0, 4))
  const min = `${year - IMPORT_MIN_YEARS_BACK}-01-01`
  const maxDate = new Date(now.getTime() + IMPORT_MAX_DAYS_FORWARD * 24 * 60 * 60 * 1000)
  const max = dateKeyInTimeZone(maxDate, "Europe/Madrid")
  return { min, max }
}

function inDateRange(fecha: string, now: Date): boolean {
  const { min, max } = importDateBounds(now)
  return fecha >= min && fecha <= max
}

function field(row: ImportRowInput, english: keyof ImportRowInput, spanish: keyof ImportRowInput): unknown {
  return row[english] ?? row[spanish]
}

export function resolveByIdOrName<T extends { id: string }>(
  items: T[],
  ref: string,
  nameOf: (item: T) => string,
): T | null {
  const exact = items.find((item) => item.id === ref)
  if (exact) return exact
  const needle = normalizeImportText(ref)
  const matches = items.filter((item) => normalizeImportText(nameOf(item)) === needle)
  return matches.length === 1 ? matches[0] : null
}

function rowType(row: ImportRowInput): unknown {
  return field(row, "type", "tipo")
}

export function prepareImportRows(
  rows: ImportRowInput[],
  accounts: McpAccount[],
  categories: McpCategory[],
  existing: DuplicateCandidate[],
  now = new Date(),
): {
  valid: PreparedImportRow[]
  errors: ImportIssue[]
  duplicates: ImportDuplicate[]
  toInsert: PreparedImportRow[]
} {
  const errors: ImportIssue[] = []
  const duplicates: ImportDuplicate[] = []
  const valid: PreparedImportRow[] = []
  const seenInBatch: PreparedImportRow[] = []

  rows.forEach((raw, index) => {
    const signed = parseImportAmount(field(raw, "amount", "monto"))
    if (signed === null) {
      errors.push({ index, error: "amount debe ser un número finito distinto de 0" })
      return
    }
    const monto = Math.abs(signed)
    const fecha = parseImportDate(field(raw, "date", "fecha"), now)
    if (!fecha) {
      errors.push({ index, error: "date debe tener el formato YYYY-MM-DD o DD/MM/YYYY" })
      return
    }
    if (!inDateRange(fecha, now)) {
      errors.push({ index, error: "date está fuera del rango permitido" })
      return
    }
    const descripcion = parseNota(field(raw, "description", "descripcion") ?? "")
    if (descripcion === null) {
      errors.push({ index, error: `la descripción no puede superar ${MAX_NOTE_LENGTH} caracteres` })
      return
    }
    const accountRef = typeof field(raw, "account", "cuenta") === "string"
      ? String(field(raw, "account", "cuenta")).trim()
      : ""
    if (!accountRef) {
      errors.push({ index, error: "account es obligatoria" })
      return
    }
    const account = resolveByIdOrName(accounts, accountRef, (item) => item.nombre)
    if (!account) {
      errors.push({ index, error: "La cuenta no existe; no se crea ninguna cuenta nueva" })
      return
    }
    const categoryRef = typeof field(raw, "category", "categoria") === "string"
      ? String(field(raw, "category", "categoria")).trim()
      : ""
    if (!categoryRef) {
      errors.push({ index, error: "category es obligatoria y debe existir ya en Garra" })
      return
    }
    const category = resolveByIdOrName(categories, categoryRef, (item) => item.name)
    if (!category) {
      errors.push({ index, error: "La categoría no existe; no se crea ninguna categoría nueva" })
      return
    }

    let tipo = parseTipo(rowType(raw))
    if (!tipo && signed < 0) tipo = "gasto"
    if (!tipo) {
      const kind = (category.kind ?? "both").toLowerCase()
      if (kind === "gasto" || kind === "ingreso") tipo = kind
    }
    if (!tipo) {
      errors.push({ index, error: "type debe ser gasto o ingreso" })
      return
    }
    if (!categoryMatchesTipo(category, tipo)) {
      errors.push({ index, error: "La categoría no corresponde al tipo de movimiento" })
      return
    }

    const prepared: PreparedImportRow = { index, fecha, monto, tipo, descripcion, account, category }
    valid.push(prepared)

    const batchTwin = seenInBatch.find((item) =>
      item.account.id === prepared.account.id &&
      item.fecha === prepared.fecha &&
      item.monto === prepared.monto &&
      descriptionsAreSimilar(item.descripcion, prepared.descripcion),
    )
    if (batchTwin) {
      duplicates.push({ index, reason: "Duplicado dentro del lote" })
      return
    }
    const existingTwin = existing.find((item) =>
      item.cuenta_id === prepared.account.id &&
      item.fecha === prepared.fecha &&
      Number(item.monto) === prepared.monto &&
      descriptionsAreSimilar(item.descripcion, prepared.descripcion),
    )
    if (existingTwin) {
      duplicates.push({ index, reason: "Ya existe un movimiento similar en Garra", existing_id: existingTwin.id })
      return
    }
    seenInBatch.push(prepared)
  })

  const duplicateIndexes = new Set(duplicates.map((item) => item.index))
  return {
    valid,
    errors,
    duplicates,
    toInsert: valid.filter((row) => !duplicateIndexes.has(row.index)),
  }
}

export type ImportPreviewResult = {
  import_token: string
  expires_at: string
  summary: {
    total_rows: number
    valid: number
    invalid: number
    duplicates: number
    to_import: number
    income: number
    expenses: number
  }
  errors: ImportIssue[]
  duplicates: ImportDuplicate[]
  sample: Array<{
    index: number
    date: string
    amount: number
    type: McpTipo
    account: string
    category: string
    description: string
  }>
}

function totals(rows: PreparedImportRow[]): { income: number; expenses: number } {
  let income = 0
  let expenses = 0
  for (const row of rows) {
    if (row.tipo === "ingreso") income = Math.round((income + row.monto) * 100) / 100
    else expenses = Math.round((expenses + row.monto) * 100) / 100
  }
  return { income, expenses }
}

export async function previewImportTransactionsTool(
  store: McpStore,
  userId: string,
  args: { rows?: unknown },
  now = new Date(),
): Promise<ToolResult<ImportPreviewResult>> {
  if (!isImportStore(store)) return { ok: false, status: 400, error: "La importación no está disponible" }
  if (!Array.isArray(args.rows)) return { ok: false, status: 400, error: "rows debe ser una lista de movimientos" }
  if (args.rows.length === 0) return { ok: false, status: 400, error: "rows no puede estar vacía" }
  if (args.rows.length > MAX_IMPORT_ROWS) {
    return { ok: false, status: 400, error: `como máximo se pueden importar ${MAX_IMPORT_ROWS} filas por lote` }
  }

  const recent = await store.countRecentImports(userId, new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
  if (recent >= MAX_IMPORTS_PER_DAY) {
    return { ok: false, status: 400, error: `has alcanzado el límite de ${MAX_IMPORTS_PER_DAY} lotes importados en 24 horas` }
  }

  const rows = args.rows as ImportRowInput[]
  const [accounts, categories] = await Promise.all([
    store.listAccounts(userId),
    store.listCategories(userId),
  ])
  const fechas = [...new Set(rows.map((row) => parseImportDate(field(row, "date", "fecha"), now)).filter((value): value is string => Boolean(value)))]
  const existing = fechas.length > 0 ? await store.listDuplicateCandidates(userId, fechas) : []
  const prepared = prepareImportRows(rows, accounts, categories, existing, now)
  const insertTotals = totals(prepared.toInsert)
  const token = newImportToken()
  const expiresAt = new Date(now.getTime() + IMPORT_TOKEN_TTL_SECONDS * 1000).toISOString()
  const payload: ImportPreviewPayload = {
    rows: prepared.toInsert.map((row) => ({
      cuenta_id: row.account.id,
      monto: row.monto,
      fecha: row.fecha,
      tipo: row.tipo,
      categoria: row.category.name,
      descripcion: row.descripcion,
    })),
    skipped_duplicates: prepared.duplicates.length,
    rows_hash: hashImportRows(rows),
  }
  await store.saveImportPreview({
    tokenHash: hashImportToken(token),
    userId,
    rowsHash: payload.rows_hash,
    payload,
    importBatchId: crypto.randomUUID(),
    createdAt: now.toISOString(),
    expiresAt,
    usedAt: null,
    result: null,
  })

  return {
    ok: true,
    data: {
      import_token: token,
      expires_at: expiresAt,
      summary: {
        total_rows: rows.length,
        valid: prepared.valid.length,
        invalid: prepared.errors.length,
        duplicates: prepared.duplicates.length,
        to_import: prepared.toInsert.length,
        income: insertTotals.income,
        expenses: insertTotals.expenses,
      },
      errors: prepared.errors,
      duplicates: prepared.duplicates,
      sample: prepared.toInsert.slice(0, IMPORT_SAMPLE_SIZE).map((row) => ({
        index: row.index,
        date: row.fecha,
        amount: row.monto,
        type: row.tipo,
        account: row.account.nombre,
        category: row.category.name,
        description: row.descripcion,
      })),
    },
  }
}

export async function importTransactionsTool(
  store: McpStore,
  userId: string,
  args: { import_token?: unknown; confirm?: unknown },
  now = new Date(),
): Promise<ToolResult<ImportCommitResult & { idempotent?: boolean }>> {
  if (!isImportStore(store)) return { ok: false, status: 400, error: "La importación no está disponible" }
  if (args.confirm !== true) {
    return { ok: false, status: 400, error: "import_transactions exige confirm=true tras mostrar la vista previa al usuario" }
  }
  const token = typeof args.import_token === "string" ? args.import_token.trim() : ""
  if (!token.startsWith(IMPORT_TOKEN_PREFIX)) {
    return { ok: false, status: 400, error: "import_token no es válido" }
  }
  const recent = await store.countRecentImports(userId, new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
  const preview = await store.getImportPreview(hashImportToken(token))
  if (!preview || preview.userId !== userId) {
    return { ok: false, status: 404, error: "import_token no es válido" }
  }
  if (!preview.usedAt && recent >= MAX_IMPORTS_PER_DAY) {
    return { ok: false, status: 400, error: `has alcanzado el límite de ${MAX_IMPORTS_PER_DAY} lotes importados en 24 horas` }
  }
  return store.importFromToken(userId, hashImportToken(token), now)
}

export function applyBatchToMemory(
  accounts: McpAccount[],
  transactions: Array<McpTransaction & { tags?: string[] }>,
  userId: string,
  payload: ImportPreviewPayload,
  batchId: string,
  now: Date,
): { accounts: McpAccount[]; created: McpTransaction[] } {
  const created: McpTransaction[] = []
  const nextAccounts = accounts.map((item) => ({ ...item }))
  for (const row of payload.rows) {
    const createdAt = now.toISOString()
    const item: McpTransaction & { tags?: string[] } = {
      id: crypto.randomUUID(),
      cuenta_id: row.cuenta_id,
      monto: row.monto,
      fecha: row.fecha,
      tipo: row.tipo,
      categoria: row.categoria,
      descripcion: row.descripcion,
      created_at: createdAt,
      tags: ["mcp", `import:${batchId}`],
    }
    created.push(item)
    transactions.push(item)
    const account = nextAccounts.find((entry) => entry.id === row.cuenta_id)
    if (account) account.saldo = Math.round((account.saldo + signedAmount(row.tipo, row.monto)) * 100) / 100
  }
  return { accounts: nextAccounts, created }
}
