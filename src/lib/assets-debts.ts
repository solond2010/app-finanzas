import type { Transaction } from "./store"
import type { UpcomingRecurring } from "./calculations"
import { localDateKey, parseLocalDate } from "./date-utils"

// Bienes (vivienda, coche…) y deudas (hipoteca, préstamos…) que el usuario
// apunta a mano. Suman/restan al patrimonio además de las cuentas; las
// cuentas con saldo negativo siguen contando como siempre (sin duplicar).

export const ASSET_TYPES = ["vivienda", "coche", "relojes", "joyas", "arte", "otro"] as const
export const DEBT_TYPES = ["hipoteca", "prestamo_coche", "personal", "tarjeta", "otra"] as const
export type AssetType = (typeof ASSET_TYPES)[number]
export type DebtType = (typeof DEBT_TYPES)[number]

export const ASSET_LABEL: Record<AssetType, string> = { vivienda: "Vivienda", coche: "Coche", relojes: "Relojes", joyas: "Joyas", arte: "Arte", otro: "Otro" }
export const DEBT_LABEL: Record<DebtType, string> = { hipoteca: "Hipoteca", prestamo_coche: "Préstamo coche", personal: "Personal", tarjeta: "Tarjeta", otra: "Otra" }

export type Asset = { id: string; nombre: string; tipo: AssetType; valor: number; valor_fecha: string | null; notas: string | null }
export type Debt = { id: string; nombre: string; tipo: DebtType; pendiente: number; principal_inicial: number | null; cuota_mensual: number | null; tin: number | null; fecha_fin: string | null; asset_id: string | null; notas: string | null; cuota_gasto_fijo: boolean; cuota_dia: number | null; cuota_cuenta_id: string | null; pendiente_at: string | null }

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const optNum = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const optStr = (v: unknown) => (typeof v === "string" && v.trim() ? v : null)

export function parseAssets(rows: Record<string, unknown>[]): Asset[] {
  return rows.filter((r) => typeof r.id === "string").map((r) => ({
    id: r.id as string,
    nombre: String(r.nombre ?? "Bien"),
    tipo: (ASSET_TYPES as readonly string[]).includes(r.tipo as string) ? (r.tipo as AssetType) : "otro",
    valor: Math.max(0, num(r.valor)),
    valor_fecha: optStr(r.valor_fecha),
    notas: optStr(r.notas),
  })).sort((a, b) => b.valor - a.valor)
}

export function parseDebts(rows: Record<string, unknown>[]): Debt[] {
  return rows.filter((r) => typeof r.id === "string").map((r) => ({
    id: r.id as string,
    nombre: String(r.nombre ?? "Deuda"),
    tipo: (DEBT_TYPES as readonly string[]).includes(r.tipo as string) ? (r.tipo as DebtType) : "otra",
    pendiente: Math.max(0, num(r.pendiente)),
    principal_inicial: optNum(r.principal_inicial),
    cuota_mensual: optNum(r.cuota_mensual),
    tin: optNum(r.tin),
    fecha_fin: optStr(r.fecha_fin),
    asset_id: optStr(r.asset_id),
    notas: optStr(r.notas),
    cuota_gasto_fijo: r.cuota_gasto_fijo === true,
    cuota_dia: optNum(r.cuota_dia),
    cuota_cuenta_id: optStr(r.cuota_cuenta_id),
    pendiente_at: optStr(r.pendiente_at) ?? optStr(r.created_at),
  })).sort((a, b) => b.pendiente - a.pendiente)
}

/** % ya devuelto (solo si se conoce el importe inicial). */
export function paidPct(d: Pick<Debt, "pendiente" | "principal_inicial">): number | null {
  if (!d.principal_inicial || d.principal_inicial <= 0) return null
  return Math.max(0, Math.min(100, (1 - d.pendiente / d.principal_inicial) * 100))
}

export function totals(assets: Asset[], debts: Debt[]) {
  const bienes = assets.reduce((s, a) => s + a.valor, 0)
  const deudas = debts.reduce((s, d) => s + d.pendiente, 0)
  const cuotas = debts.reduce((s, d) => s + (d.cuota_mensual ?? 0), 0)
  return { bienes, deudas, cuotas, neto: bienes - deudas }
}

// ── Cuota de la deuda como gasto fijo ──────────────────────────────────────
// No se crea ningún movimiento (no toca saldos): la deuda genera un gasto fijo
// «virtual» en la agenda. Al registrarlo se guarda un movimiento normal con la
// etiqueta deuda:<id>, que marca el último pago para calcular el siguiente.
export const debtTag = (id: string) => `deuda:${id}`
export const DEBT_CATEGORY: Record<DebtType, string> = { hipoteca: "Hipoteca", prestamo_coche: "Préstamos", personal: "Préstamos", tarjeta: "Tarjeta", otra: "Préstamos" }
export const debtFixedName = (d: Pick<Debt, "tipo" | "nombre">) => `Cuota ${d.tipo === "hipoteca" ? "hipoteca" : d.tipo === "tarjeta" ? "tarjeta" : "préstamo"} – ${d.nombre}`
export const hasDebtFixed = (d: Debt) => d.cuota_gasto_fijo && (d.cuota_mensual ?? 0) > 0 && !!d.cuota_cuenta_id

function dayIn(year: number, month: number, day: number) {
  return new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()))
}

export function debtRecurring(debts: Debt[], transactions: Transaction[], today = new Date()): UpcomingRecurring[] {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return debts.filter(hasDebtFixed).map((d) => {
    const tag = debtTag(d.id)
    const day = Math.min(Math.max(d.cuota_dia ?? 1, 1), 31)
    const paid = transactions.filter((t) => t.tags?.includes(tag)).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    let next: Date
    if (paid) { const p = parseLocalDate(paid.fecha); next = dayIn(p.getFullYear(), p.getMonth() + 1, day) }
    else { next = dayIn(t0.getFullYear(), t0.getMonth(), day); if (next < t0) next = dayIn(t0.getFullYear(), t0.getMonth() + 1, day) }
    return {
      key: tag,
      sourceTransactionId: "",
      cuenta_id: d.cuota_cuenta_id as string,
      categoria: DEBT_CATEGORY[d.tipo],
      descripcion: debtFixedName(d),
      monto: d.cuota_mensual as number,
      tipo: "gasto" as const,
      es_necesidad: true,
      tags: [tag],
      frequency: "mensual" as const,
      nextDate: localDateKey(next),
      overdueDays: Math.round((t0.getTime() - next.getTime()) / 86400000),
    }
  })
}

// Momento de referencia para deudas sin pendiente_at (p. ej. la demo): el
// arranque de la sesión, para que solo cuenten las cuotas marcadas después.
const SESSION_START = new Date().toISOString()

/** Pendiente real: el guardado menos las cuotas («Ya se realizó») creadas
 * después de guardarlo. Se calcula, no se escribe: deshacer o borrar el
 * movimiento lo devuelve solo y nunca se aplica dos veces. */
export function applyDebtPayments(debts: Debt[], transactions: Transaction[]): Debt[] {
  if (!debts.length) return debts
  return debts.map((d) => {
    const tag = debtTag(d.id)
    const since = d.pendiente_at ?? SESSION_START
    const paid = transactions.reduce((sum, t) => (t.tipo === "gasto" && t.tags?.includes(tag) && (t.created_at ?? `${t.fecha}T23:59:59Z`) > since ? sum + Math.abs(t.monto) : sum), 0)
    return paid > 0 ? { ...d, pendiente: Math.max(0, Math.round((d.pendiente - paid) * 100) / 100) } : d
  })
}

// ── Historial de valor de los bienes ───────────────────────────────────────
export type AssetValue = { id: string; asset_id: string; valor: number; fecha: string }

export function parseAssetValues(rows: Record<string, unknown>[]): AssetValue[] {
  return rows
    .filter((r) => typeof r.id === "string" && typeof r.asset_id === "string" && typeof r.fecha === "string")
    .map((r) => ({ id: r.id as string, asset_id: r.asset_id as string, valor: Math.max(0, num(r.valor)), fecha: (r.fecha as string).slice(0, 10) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id))
}

/** Convierte la clave de un punto de la gráfica ("2026-07" o "2026-07-15") en
 * el último día que representa. */
function pointDay(key: string, todayKey: string): string {
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split("-").map(Number)
    const end = `${key}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`
    return end > todayKey ? todayKey : end
  }
  return key.slice(0, 10)
}

/** Valor de un bien en una fecha: el último registro de historial hasta ese
 * día. Antes del primer registro el bien no cuenta (0). Sin historial, se usa
 * su valor actual desde valor_fecha (o siempre, si no tiene fecha). */
export function assetValueAt(asset: Asset, values: AssetValue[], day: string): number {
  const own = values.filter((v) => v.asset_id === asset.id)
  if (!own.length) return !asset.valor_fecha || asset.valor_fecha <= day ? asset.valor : 0
  let val = 0
  for (const v of own) { if (v.fecha <= day) val = v.valor; else break }
  return val
}

function assetStart(asset: Asset, values: AssetValue[]): string | null {
  return values.find((v) => v.asset_id === asset.id)?.fecha ?? asset.valor_fecha
}

/** Pendiente de una deuda en una fecha: el actual más las cuotas pagadas
 * después de ese día. Si está ligada a un bien, no cuenta antes del primer
 * valor de ese bien (no había deuda sin el bien). */
export function debtPendingAt(debt: Debt, transactions: Transaction[], day: string, assets: Asset[], values: AssetValue[]): number {
  const linked = debt.asset_id ? assets.find((a) => a.id === debt.asset_id) : null
  const start = linked ? assetStart(linked, values) : null
  if (start && day < start) return 0
  const tag = debtTag(debt.id)
  const later = transactions.reduce((s, t) => (t.tipo === "gasto" && t.fecha > day && t.tags?.includes(tag) ? s + Math.abs(t.monto) : s), 0)
  return debt.pendiente + later
}

/** Bienes − deudas en la fecha de un punto de la gráfica. */
export function assetDebtNetAt(key: string, assets: Asset[], values: AssetValue[], debts: Debt[], transactions: Transaction[], todayKey: string): number {
  const day = pointDay(key, todayKey)
  const bienes = assets.reduce((s, a) => s + assetValueAt(a, values, day), 0)
  const deudas = debts.reduce((s, d) => s + debtPendingAt(d, transactions, day, assets, values), 0)
  return bienes - deudas
}
