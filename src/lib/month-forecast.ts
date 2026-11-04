// Previsión de fin de mes (función pura, ver month-forecast.test.ts).
export type ForecastTx = { tipo: "ingreso" | "gasto"; monto: number; fecha: string; tags?: string[] }
export type ForecastRecurring = { tipo: "ingreso" | "gasto"; monto: number; nextDate: string }

const isFixed = (t: ForecastTx) => (t.tags ?? []).some((g) => g === "recurrente" || g.startsWith("recurrente") || g.startsWith("deuda:"))

/** null si van menos de 3 días del mes. Movimientos = solo los del mes en curso. */
export function monthEndForecast(transactions: ForecastTx[], recurring: ForecastRecurring[], today: Date): number | null {
  const day = today.getDate()
  if (day < 3) return null
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  const endKey = `${monthKey}-${String(daysInMonth).padStart(2, "0")}`
  let income = 0, expenses = 0, variable = 0
  for (const t of transactions) {
    if (!t.fecha.startsWith(monthKey)) continue
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
