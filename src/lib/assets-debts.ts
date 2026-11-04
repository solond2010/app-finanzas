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
export type Debt = { id: string; nombre: string; tipo: DebtType; pendiente: number; principal_inicial: number | null; cuota_mensual: number | null; tin: number | null; fecha_fin: string | null; asset_id: string | null; notas: string | null }

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
