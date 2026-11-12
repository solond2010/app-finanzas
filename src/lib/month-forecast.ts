// Previsión de fin de mes (función pura, ver month-forecast.test.ts).
import { countsTowardCashFlow } from "@/lib/calculations"
import type { Transaction } from "@/lib/store"

export type ForecastTx = {
  tipo: "ingreso" | "gasto"
  monto: number
  fecha: string
  tags?: string[]
  id?: string
  cuenta_id?: string
}
export type ForecastRecurring = { tipo: "ingreso" | "gasto"; monto: number; nextDate: string }

const isFixed = (t: ForecastTx) => (t.tags ?? []).some((g) => g === "recurrente" || g.startsWith("recurrente") || g.startsWith("deuda:"))

function asTransaction(t: ForecastTx, index: number): Transaction {
  return {
    id: t.id ?? `tmp_${index}`,
    cuenta_id: t.cuenta_id ?? "",
    monto: t.monto,
    fecha: t.fecha,
    tipo: t.tipo,
    categoria: "",
    es_necesidad: false,
    descripcion: "",
    tags: t.tags ?? [],
  }
}

/** null si van menos de 3 días del mes. Movimientos = solo los del mes en curso. */
export function monthEndForecast(transactions: ForecastTx[], recurring: ForecastRecurring[], today: Date): number | null {
  const day = today.getDate()
  if (day < 3) return null
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  const endKey = `${monthKey}-${String(daysInMonth).padStart(2, "0")}`
  const all = transactions.map(asTransaction)
  let income = 0, expenses = 0, variable = 0
  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i]!
    const tx = all[i]!
    if (!t.fecha.startsWith(monthKey)) continue
    if (!countsTowardCashFlow(tx, all)) continue
    const v = Math.abs(t.monto)
    if (t.tipo === "ingreso") income += v
    else { expenses += v; if (!isFixed(t)) variable += v }
  }
  const variableRest = Math.max(0, (variable / day) * daysInMonth - variable)
  // Gastos/ingresos fijos aún no apuntados con fecha prevista dentro de este mes
  // (los atrasados también cuentan: siguen pendientes).
  let pendingIn = 0, pendingOut = 0
  for (const r of recurring) {
    if (r.nextDate > endKey) continue
    if (r.tipo === "ingreso") pendingIn += Math.abs(r.monto); else pendingOut += Math.abs(r.monto)
  }
  return Math.round((income + pendingIn - expenses - variableRest - pendingOut) * 100) / 100
}
