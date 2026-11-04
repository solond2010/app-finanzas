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
export type Debt = { id: string; nombre: string; tipo: DebtType; pendiente: number; principal_inicial: number | null; cuota_mensual: number | null; tin: number | null; fecha_fin: string | null; asset_id: string | null; notas: string | null; cuota_gasto_fijo: boolean; cuota_dia: number | null; cuota_cuenta_id: string | null }

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
