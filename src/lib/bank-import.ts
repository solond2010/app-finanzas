// Importación de extractos bancarios en CSV (BBVA, ING, Santander, CaixaBank,
// Sabadell, Revolut, N26, MyInvestor…). Lógica pura, sin UI: todo se procesa
// en el navegador; solo se guardan los movimientos elegidos, como siempre.
import { parseCsv } from "./csv-import"

export type DateOrder = "dmy" | "mdy" | "ymd"
export type DecimalSep = "," | "."

export interface ColumnMapping {
  date: number
  description: number
  /** Importe con signo (−gasto / +ingreso). -1 si el banco usa debe/haber. */
  amount: number
  debit: number
  credit: number
  /** Columna «Tipo» con ingreso/gasto, cargo/abono, D/H (p. ej. la exportación de Garra). */
  type?: number
}

const NEG_TYPES = /^(gasto|cargo|debe|d|debit|egreso|salida)$/
const TYPE_VALUES = /^(ingreso|gasto|cargo|abono|debe|haber|d|h|debit|credit|egreso|salida|entrada)$/

export interface BankTable {
  delimiter: string
  header: string[]
  rows: string[][]
  mapping: ColumnMapping
  decimal: DecimalSep
  dateOrder: DateOrder
}

export interface ParsedMovement {
  row: number
  fecha: string
  descripcion: string
  monto: number
  tipo: "ingreso" | "gasto"
}

export function decodeBytes(buf: ArrayBuffer): string {
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf)
  } catch {
    text = new TextDecoder("windows-1252").decode(buf)
  }
  return text.replace(/^\uFEFF/, "")
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()

/** El delimitador que da un número de columnas más estable (y > 1). */
export function detectBankDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 40)
  let best = ","
  let bestScore = -1
  for (const d of [";", ",", "\t", "|"]) {
    const counts = lines.map((l) => parseCsv(l, d)[0]?.length ?? 1)
    const freq = new Map<number, number>()
    for (const c of counts) if (c > 1) freq.set(c, (freq.get(c) ?? 0) + 1)
    const [cols, times] = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] ?? [1, 0]
    const score = times * 100 + cols
    if (times > 0 && score > bestScore) { best = d; bestScore = score }
  }
  return best
}

const HEADER_WORDS = /fecha|date|concepto|descrip|importe|amount|cantidad|debe|haber|cargo|abono|saldo|balance|movimiento|operaci|beneficiario|payee|referencia|reference|detalle/

const MONTHS: Record<string, number> = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12 }

function validDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null
  const dt = new Date(y, m - 1, d)
  if (dt.getMonth() !== m - 1) return null
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

/** Fecha de banco → AAAA-MM-DD. Admite dd/mm/aaaa, dd-mm-aa, dd.mm.aaaa,
 * aaaa-mm-dd (con hora), «03 oct 2026» y números de serie de Excel. */
export function parseBankDate(raw: string, order: DateOrder = "dmy"): string | null {
  const s = norm(raw).replace(/^"|"$/g, "")
  if (!s) return null
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ t].*)?$/)
  if (m) return validDate(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ t].*)?$/)
  if (m) return order === "mdy" ? validDate(+m[3], +m[1], +m[2]) : validDate(+m[3], +m[2], +m[1])
  m = s.match(/^(\d{1,2})[-/ .]([a-z]{3})[a-z]*\.?[-/ .](\d{2,4})$/)
  if (m && MONTHS[m[2]]) return validDate(+m[3], MONTHS[m[2]], +m[1])
  if (/^\d{5}$/.test(s)) {
    const serial = +s
    if (serial > 30000 && serial < 70000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
      return validDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
    }
  }
  return null
}

/** Importe de banco → número con signo. «1.234,56», «-1,234.56», «12,00 €»,
 * «(12,00)», «12,00-», «+300». */
export function parseBankAmount(raw: string, decimal: DecimalSep = ","): number | null {
  let s = (raw ?? "").replace(/[\s\u00a0]|€|eur|usd|\$|£/gi, "")
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  if (s.endsWith("-")) { negative = true; s = s.slice(0, -1) }
  if (s.startsWith("+")) s = s.slice(1)
  if (s.startsWith("-")) { negative = !negative; s = s.slice(1) }
  if (!/^[\d.,']+$/.test(s)) return null
  s = s.replace(/'/g, "")
  const lastComma = s.lastIndexOf(",")
  const lastDot = s.lastIndexOf(".")
  let dec: DecimalSep | null = null
  if (lastComma >= 0 && lastDot >= 0) dec = lastComma > lastDot ? "," : "."
  else if (lastComma >= 0) dec = /^\d{1,3}(,\d{3})+$/.test(s) && decimal === "." ? null : ","
  else if (lastDot >= 0) dec = /^\d{1,3}(\.\d{3})+$/.test(s) && decimal === "," ? null : "."
  const thousands = dec === "," ? "." : ","
  s = s.split(thousands).join("")
  if (dec === ",") s = s.replace(",", ".")
  if (dec === null) s = s.replace(/[.,]/g, "")
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

function detectDecimal(values: string[]): DecimalSep {
  let comma = 0, dot = 0
  for (const v of values) {
    if (/,\d{1,2}(?:\D*)$/.test(v.trim())) comma++
    else if (/\.\d{1,2}(?:\D*)$/.test(v.trim())) dot++
  }
  return dot > comma ? "." : ","
}

function detectDateOrder(values: string[]): DateOrder {
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/)
    if (m && +m[1] > 12) return "dmy"
    if (m && +m[2] > 12) return "mdy"
  }
  return "dmy"
}

const pick = (header: string[], patterns: RegExp[], skip: number[] = []) => {
  for (const p of patterns) {
    const i = header.findIndex((h, idx) => !skip.includes(idx) && p.test(h))
    if (i >= 0) return i
  }
  return -1
}

/** Columnas más probables según la cabecera (y los datos si hace falta). */
export function guessMapping(headerRaw: string[], sample: string[][]): ColumnMapping {
  const header = headerRaw.map(norm)
  const numericShare = (i: number) => sample.filter((r) => parseBankAmount(r[i] ?? "") !== null).length / Math.max(1, sample.length)
  const dateShare = (i: number) => sample.filter((r) => parseBankDate(r[i] ?? "") !== null).length / Math.max(1, sample.length)
  let date = pick(header, [/fecha.*operaci/, /^f\.? ?oper/, /^fecha$/, /completed date/, /started date/, /booking date|^date$|fecha contable/, /fecha/, /date/])
  if (date < 0 || dateShare(date) < 0.5) {
    const byData = header.findIndex((_, i) => dateShare(i) >= 0.6)
    if (byData >= 0) date = byData
  }
  const balanceIdx = header.map((h, i) => (/saldo|balance/.test(h) ? i : -1)).filter((i) => i >= 0)
  const amount = pick(header, [/^importe|^amount|^cantidad|^monto|importe|amount \(eur\)/], [date, ...balanceIdx])
  const debit = pick(header, [/^debe$|cargo|debit|salida|^gastos?$|retirada/], [date, ...balanceIdx])
  const credit = pick(header, [/^haber$|abono|credit|entrada|^ingresos?$/], [date, ...balanceIdx])
  const description = pick(header, [/concepto|descrip|detalle|^payee|beneficiario|merchant|^movimiento|referencia|reference|observaciones|^name$/], [date, amount, debit, credit, ...balanceIdx])
  let finalAmount = amount
  if (finalAmount < 0 && (debit < 0 || credit < 0)) {
    finalAmount = header.findIndex((_, i) => i !== date && !balanceIdx.includes(i) && numericShare(i) >= 0.8)
  }
  let finalDesc = description
  if (finalDesc < 0) {
    let bestLen = -1
    header.forEach((_, i) => {
      if (i === date || i === finalAmount || numericShare(i) > 0.5) return
      const len = sample.reduce((s, r) => s + (r[i] ?? "").length, 0)
      if (len > bestLen) { bestLen = len; finalDesc = i }
    })
  }
  const typeCol = header.findIndex((h) => /^(tipo|type|d\/h|signo)$/.test(h))
  const type = typeCol >= 0 && sample.length > 0 && sample.every((r) => TYPE_VALUES.test(norm(r[typeCol] ?? ""))) ? typeCol : -1
  return { date, description: finalDesc, amount: finalAmount >= 0 ? finalAmount : -1, debit: finalAmount >= 0 ? -1 : debit, credit: finalAmount >= 0 ? -1 : credit, type }
}

/** Lee el texto del CSV: delimitador, fila de cabecera (los bancos suelen
 * poner antes unas líneas con el titular o el periodo), decimales y fechas. */
export function readBankCsv(text: string): BankTable | null {
  const delimiter = detectBankDelimiter(text)
  const all = parseCsv(text, delimiter).map((r) => r.map((c) => c.trim()))
  if (all.length < 2) return null
  let headerIndex = all.findIndex((r, i) => i < 40 && r.filter((c) => HEADER_WORDS.test(norm(c))).length >= 2)
  if (headerIndex < 0) headerIndex = -1
  const header = headerIndex >= 0 ? all[headerIndex] : all[0].map((_, i) => `Columna ${i + 1}`)
  const rows = all.slice(headerIndex + 1).filter((r) => r.length >= Math.min(2, header.length))
  if (!rows.length) return null
  const sample = rows.slice(0, 50)
  const mapping = guessMapping(header, sample)
  const amountCols = [mapping.amount, mapping.debit, mapping.credit].filter((i) => i >= 0)
  const decimal = detectDecimal(sample.flatMap((r) => amountCols.map((i) => r[i] ?? "")))
  const dateOrder = mapping.date >= 0 ? detectDateOrder(sample.map((r) => r[mapping.date] ?? "")) : "dmy"
  return { delimiter, header, rows, mapping, decimal, dateOrder }
}

/** Filas → movimientos. Se saltan las que no tienen fecha o importe (totales,
 * saldo final, líneas en blanco del pie). */
export function toMovements(table: Pick<BankTable, "rows" | "mapping" | "decimal" | "dateOrder">): { movements: ParsedMovement[]; skipped: number } {
  const { rows, mapping, decimal, dateOrder } = table
  const movements: ParsedMovement[] = []
  let skipped = 0
  rows.forEach((r, row) => {
    const fecha = mapping.date >= 0 ? parseBankDate(r[mapping.date] ?? "", dateOrder) : null
    let value: number | null = null
    if (mapping.amount >= 0) {
      value = parseBankAmount(r[mapping.amount] ?? "", decimal)
      if (value !== null && mapping.type !== undefined && mapping.type >= 0) value = NEG_TYPES.test(norm(r[mapping.type] ?? "")) ? -Math.abs(value) : Math.abs(value)
    }
    else if (mapping.debit >= 0 || mapping.credit >= 0) {
      const debit = mapping.debit >= 0 ? parseBankAmount(r[mapping.debit] ?? "", decimal) : null
      const credit = mapping.credit >= 0 ? parseBankAmount(r[mapping.credit] ?? "", decimal) : null
      if (debit !== null || credit !== null) value = Math.abs(credit ?? 0) - Math.abs(debit ?? 0)
    }
    if (!fecha || value === null || value === 0) { skipped++; return }
    const descripcion = (mapping.description >= 0 ? r[mapping.description] ?? "" : "").replace(/\s+/g, " ").trim().slice(0, 200)
    movements.push({ row, fecha, descripcion, monto: Math.round(Math.abs(value) * 100) / 100, tipo: value < 0 ? "gasto" : "ingreso" })
  })
  return { movements, skipped }
}

const words = (s: string) => new Set(norm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !/^\d+$/.test(w)))

export function similarDescription(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b)
  if (!na || !nb || na.includes(nb) || nb.includes(na)) return true
  const wa = words(a), wb = words(b)
  if (!wa.size || !wb.size) return true
  let common = 0
  for (const w of wa) if (wb.has(w)) common++
  return common / Math.min(wa.size, wb.size) >= 0.5
}

/** Movimientos que ya existen en la cuenta: misma fecha e importe y
 * descripción parecida. Cada existente solo «tapa» un importado. */
export function findDuplicates(movements: ParsedMovement[], existing: { fecha: string; monto: number; tipo: string; descripcion: string }[]): Set<number> {
  const pool = existing.map((e) => ({ ...e, used: false }))
  const dup = new Set<number>()
  for (const m of movements) {
    const hit = pool.find((e) => !e.used && e.fecha === m.fecha && e.tipo === m.tipo && Math.abs(e.monto - m.monto) < 0.005 && similarDescription(e.descripcion, m.descripcion))
    if (hit) { hit.used = true; dup.add(m.row) }
  }
  return dup
}
