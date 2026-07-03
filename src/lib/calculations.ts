import type { Account, Transaction, MonthlySummary, NetWorthSnapshot } from "./store"
import { convertToEur } from "./currency"

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number)
  return new Date(year, month - 1, 1)
}

function getMonthWindow(endMonthKey: string | undefined, count = 6) {
  const end = endMonthKey ? parseMonthKey(endMonthKey) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  return Array.from({ length: count }, (_, index) => getMonthKey(new Date(end.getFullYear(), end.getMonth() - (count - 1 - index), 1)))
}

function isInMonth(dateString: string, monthKey: string) {
  const d = new Date(dateString)
  const monthDate = parseMonthKey(monthKey)
  return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth()
}

function isAfterMonth(dateString: string, monthKey: string) {
  const d = new Date(dateString)
  const nextMonth = new Date(parseMonthKey(monthKey).getFullYear(), parseMonthKey(monthKey).getMonth() + 1, 1)
  return d >= nextMonth
}

function transactionDelta(t: Transaction) {
  return t.tipo === "ingreso" ? t.monto : -t.monto
}

// Un traspaso entre cuentas propias se registra como gasto en la cuenta origen
// e ingreso en la destino (para que cuadren los saldos), pero NO es un ingreso
// ni un gasto real, así que se excluye de los totales de reporte. En patrimonio
// ya netea a cero (–50 origen + 50 destino).
export function isTransfer(t: Transaction) {
  return t.tags?.includes("traspaso") ?? false
}

export function filterTransactionsByMonth(transactions: Transaction[], monthKey?: string) {
  if (!monthKey) return transactions
  return transactions.filter((t) => isInMonth(t.fecha, monthKey))
}

export function getLastQuarterTransactions(transactions: Transaction[]) {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  return transactions.filter((t) => new Date(t.fecha) >= threeMonthsAgo)
}

export function calculateAverageMonthlyNeeds(transactions: Transaction[]): number {
  const lastQuarter = getLastQuarterTransactions(transactions)
  const needsExpenses = lastQuarter.filter((t) => t.tipo === "gasto" && t.es_necesidad)
  const totalNeeds = needsExpenses.reduce((sum, t) => sum + t.monto, 0)
  return Math.round(totalNeeds / 3)
}

export function calculateEmergencyFund(transactions: Transaction[], accounts: Account[], months: number): { needed: number; saved: number } {
  const monthlyAvg = calculateAverageMonthlyNeeds(transactions)
  const needed = monthlyAvg * months
  const emergencyAccount = accounts.find((a) => a.tipo === "emergencia")
  const saved = emergencyAccount?.saldo ?? 0
  return { needed, saved }
}

export function getCurrentMonthTotals(transactions: Transaction[]) {
  const { ingresos, gastos } = getMonthTotals(transactions, 0)
  return { ingresos, gastos, neto: ingresos - gastos }
}

export function getMonthTotalsByString(transactions: Transaction[], month: string) {
  const monthTxns = filterTransactionsByMonth(transactions, month)
  const ingresos = monthTxns.filter((t) => t.tipo === "ingreso" && !isTransfer(t)).reduce((s, t) => s + t.monto, 0)
  const gastos = monthTxns.filter((t) => t.tipo === "gasto" && !isTransfer(t)).reduce((s, t) => s + t.monto, 0)
  return { ingresos, gastos, neto: ingresos - gastos }
}

// neto/ingresos no tiene techo por abajo (gastos puede disparar la ratio), así
// que se acota en -100% para evitar cifras absurdas cuando los ingresos del mes son bajos.
export function getSavingsRate(ingresos: number, neto: number): number {
  if (ingresos <= 0) return 0
  return Math.max(-100, Math.round((neto / ingresos) * 100))
}

// Dinero movido este mes desde otras cuentas hacia cuentas de tipo "inversion"
// (traspasos, no aportes registrados posición a posición). Sirve como proxy de
// "cuánto has invertido este mes" para el informe X-Ray.
export function getMonthlyInvestmentInflow(transactions: Transaction[], accounts: Account[], monthKey: string): number {
  const investAccountIds = new Set(accounts.filter((a) => a.tipo === "inversion").map((a) => a.id))
  return filterTransactionsByMonth(transactions, monthKey)
    .filter((t) => t.tipo === "ingreso" && isTransfer(t) && investAccountIds.has(t.cuenta_id))
    .reduce((s, t) => s + t.monto, 0)
}

export function getMonthTotals(transactions: Transaction[], monthsAgo: number) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
  const month = d.getMonth()
  const year = d.getFullYear()

  const monthTxns = transactions.filter((t) => {
    const td = new Date(t.fecha)
    return td.getMonth() === month && td.getFullYear() === year
  })

  const ingresos = monthTxns.filter((t) => t.tipo === "ingreso" && !isTransfer(t)).reduce((s, t) => s + t.monto, 0)
  const gastos = monthTxns.filter((t) => t.tipo === "gasto" && !isTransfer(t)).reduce((s, t) => s + t.monto, 0)

  return { ingresos, gastos, neto: ingresos - gastos, label: formatMonth(d) }
}

function formatMonth(d: Date) {
  return d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" })
}

export function getCurrentMonthNeedsVsWants(transactions: Transaction[]) {
  return getNeedsVsWantsForMonth(transactions)
}

export function getNeedsVsWantsForMonth(transactions: Transaction[], monthKey?: string) {
  const monthTransactions = filterTransactionsByMonth(transactions, monthKey).filter((t) => t.tipo === "gasto" && !isTransfer(t))
  const necesidades = monthTransactions.filter((t) => t.es_necesidad).reduce((s, t) => s + t.monto, 0)
  const deseos = monthTransactions.filter((t) => !t.es_necesidad).reduce((s, t) => s + t.monto, 0)
  return { necesidades, deseos }
}

export function getNetWorth(accounts: Account[]): number {
  return accounts.reduce((sum, a) => sum + convertToEur(a.saldo, a.currency), 0)
}

export function getAccountsAtMonth(accounts: Account[], transactions: Transaction[], monthKey?: string) {
  if (!monthKey) return accounts
  return accounts.map((account) => {
    const futureTransactions = transactions.filter((t) => t.cuenta_id === account.id && isAfterMonth(t.fecha, monthKey))
    const balanceDelta = futureTransactions.reduce((sum, t) => sum + transactionDelta(t), 0)
    return { ...account, saldo: account.saldo - balanceDelta }
  })
}

export function getNetWorthAtMonth(accounts: Account[], transactions: Transaction[], monthKey?: string) {
  return getNetWorth(getAccountsAtMonth(accounts, transactions, monthKey))
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

// Igual que isAfterMonth pero a nivel de día: una transacción cuenta como
// "futura" respecto a dateKey solo si es de un día posterior (las del mismo
// día ya forman parte del saldo de cierre de ese día).
function isAfterDate(dateString: string, dateKey: string) {
  return toDateKey(new Date(dateString)) > dateKey
}

export function getAccountsAtDate(accounts: Account[], transactions: Transaction[], dateKey: string) {
  return accounts.map((account) => {
    const futureTransactions = transactions.filter((t) => t.cuenta_id === account.id && isAfterDate(t.fecha, dateKey))
    const balanceDelta = futureTransactions.reduce((sum, t) => sum + transactionDelta(t), 0)
    return { ...account, saldo: account.saldo - balanceDelta }
  })
}

export function getNetWorthAtDate(accounts: Account[], transactions: Transaction[], dateKey: string) {
  return getNetWorth(getAccountsAtDate(accounts, transactions, dateKey))
}

// Histórico día a día de los últimos `days` días (incluye hoy), para rangos
// cortos donde el detalle mensual esconde subidas/bajadas reales de la
// semana (cuentas nuevas con pocos días de historial, gasto puntual grande...).
//
// Si un día tiene ingresos Y gastos a la vez (típico cuando las transacciones
// son de antes de tener `created_at` real, o cuando simplemente varias cosas
// pasan el mismo día), un único punto de cierre esconde el pico intermedio:
// "cobré esto, luego gasté aquello" se ve como una línea plana. Sin saber el
// orden real, el punto más alto defendible es "todos los ingresos del día
// contados antes que los gastos" — no asume una hora concreta, solo que el
// día tuvo ese máximo alcanzable. Se añade como punto extra antes del cierre.
export function buildNetWorthHistoryDaily(accounts: Account[], transactions: Transaction[], days: number, endDate = new Date()): NetWorthSnapshot[] {
  const currencyByAccount = new Map(accounts.map((a) => [a.id, a.currency]))
  const points: NetWorthSnapshot[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - (days - 1 - i))
    const dateKey = toDateKey(d)
    const dayLabel = d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
    const dayEnd = getNetWorthAtDate(accounts, transactions, dateKey)
    const todaysTransactions = transactions.filter((t) => toDateKey(new Date(t.fecha)) === dateKey)
    const outflow = todaysTransactions
      .filter((t) => t.tipo === "gasto")
      .reduce((sum, t) => sum + convertToEur(t.monto, currencyByAccount.get(t.cuenta_id) ?? "EUR"), 0)
    const hasInflow = todaysTransactions.some((t) => t.tipo === "ingreso")
    if (hasInflow && outflow > 0) {
      points.push({ mes: `${dayLabel} · pico`, patrimonio: dayEnd + outflow })
    }
    points.push({ mes: dayLabel, patrimonio: dayEnd })
  }
  return points
}

// Una transacción es "futura" respecto al instante (dateKey, createdAt) si es
// de un día posterior, o del mismo día pero dada de alta después (empate
// resuelto por `created_at`, no por `fecha`, que no tiene hora).
function isAfterMoment(t: Transaction, dateKey: string, createdAt: string) {
  const tDateKey = toDateKey(new Date(t.fecha))
  if (tDateKey !== dateKey) return tDateKey > dateKey
  return (t.created_at ?? "") > createdAt
}

function getNetWorthAtMoment(accounts: Account[], transactions: Transaction[], dateKey: string, createdAt: string) {
  const reconstructed = accounts.map((account) => {
    const futureTransactions = transactions.filter((t) => t.cuenta_id === account.id && isAfterMoment(t, dateKey, createdAt))
    const balanceDelta = futureTransactions.reduce((sum, t) => sum + transactionDelta(t), 0)
    return { ...account, saldo: account.saldo - balanceDelta }
  })
  return getNetWorth(reconstructed)
}

// Evolución del día en curso, un punto por cada transacción dada de alta hoy
// (ordenadas por `created_at`, no por `fecha`) más un punto de partida con el
// patrimonio de cierre de ayer. Para cuentas muy nuevas, la resolución diaria
// no basta: si todo el movimiento del día pasó en las mismas 24h, un solo
// punto por día esconde igual que antes el pico intermedio.
export function buildNetWorthHistoryToday(accounts: Account[], transactions: Transaction[], today = new Date()): NetWorthSnapshot[] {
  const todayKey = toDateKey(today)
  const yesterdayKey = toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))
  const todaysTransactions = transactions
    .filter((t) => toDateKey(new Date(t.fecha)) === todayKey)
    .slice()
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))

  const points: NetWorthSnapshot[] = [{ mes: "Inicio", patrimonio: getNetWorthAtDate(accounts, transactions, yesterdayKey) }]
  for (const t of todaysTransactions) {
    const label = t.created_at ? new Date(t.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—"
    points.push({ mes: label, patrimonio: getNetWorthAtMoment(accounts, transactions, todayKey, t.created_at ?? "") })
  }
  return points
}

export function getCategoryBreakdown(transactions: Transaction[], monthKey?: string) {
  const gastos = filterTransactionsByMonth(transactions, monthKey).filter((t) => t.tipo === "gasto" && !isTransfer(t))

  const breakdown: Record<string, number> = {}
  for (const t of gastos) {
    breakdown[t.categoria] = (breakdown[t.categoria] || 0) + t.monto
  }

  return Object.entries(breakdown)
    .map(([categoria, monto]) => ({ categoria, monto }))
    .sort((a, b) => b.monto - a.monto)
}

export function calculateMonthlySaving(amountTarget: number, current: number, deadline: string): number {
  const now = new Date()
  const end = new Date(deadline)
  const monthsLeft = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
  if (monthsLeft <= 0) return 0
  return Math.round((amountTarget - current) / monthsLeft)
}

export function buildMonthlySummaries(transactions: Transaction[]): MonthlySummary[] {
  return buildMonthlySummariesUpTo(transactions)
}

export function buildMonthlySummariesUpTo(transactions: Transaction[], endMonthKey?: string): MonthlySummary[] {
  return getMonthWindow(endMonthKey).map((month) => {
    const { ingresos, gastos } = getMonthTotalsByString(transactions, month)
    return { mes: formatMonth(parseMonthKey(month)), ingresos, gastos }
  })
}

export function buildMonthlyCashFlow(transactions: Transaction[], endMonthKey?: string): { mes: string; ingresos: number; gastos: number; neto: number }[] {
  return getMonthWindow(endMonthKey).map((month) => {
    const { ingresos, gastos, neto } = getMonthTotalsByString(transactions, month)
    return { mes: formatMonth(parseMonthKey(month)), ingresos, gastos, neto }
  })
}

export function buildNetWorthHistory(transactions: Transaction[], accounts: Account[], endMonthKey?: string): NetWorthSnapshot[] {
  return getMonthWindow(endMonthKey).map((month) => ({
    mes: formatMonth(parseMonthKey(month)),
    patrimonio: getNetWorthAtMonth(accounts, transactions, month),
  }))
}

export function getGastosBudgetProgress(accounts: Account[], transactions: Transaction[], monthKey?: string) {
  const gastosAccount = accounts.find((a) => a.tipo === "gastos")
  if (!gastosAccount || !gastosAccount.limite_mensual) return null

  const gastado = filterTransactionsByMonth(transactions, monthKey)
    .filter((t) => t.tipo === "gasto" && t.cuenta_id === gastosAccount.id)
    .reduce((s, t) => s + t.monto, 0)

  return {
    gastado,
    limite: gastosAccount.limite_mensual,
    restante: gastosAccount.limite_mensual - gastado,
    progreso: Math.min(Math.round((gastado / gastosAccount.limite_mensual) * 100), 100),
  }
}

export type RecurringFrequency = "semanal" | "mensual" | "anual"

// Cadencia guardada como tag: "recurrente" a secas (dato histórico, antes de
// que existieran más cadencias) siempre significa mensual; "recurrente:X"
// guarda la cadencia explícita. Mantenerlo así evita una migración de datos.
export function isRecurringTransaction(t: Transaction) {
  return t.tags?.some((tag) => tag === "recurrente" || tag.startsWith("recurrente:")) ?? false
}

export function recurringFrequency(t: Transaction): RecurringFrequency {
  const tag = t.tags?.find((tag) => tag.startsWith("recurrente:"))
  const freq = tag?.split(":")[1]
  return freq === "semanal" || freq === "anual" ? freq : "mensual"
}

export function recurringTag(freq: RecurringFrequency): string {
  return freq === "mensual" ? "recurrente" : `recurrente:${freq}`
}

function addFrequency(date: Date, freq: RecurringFrequency): Date {
  const next = new Date(date)
  if (freq === "semanal") next.setDate(next.getDate() + 7)
  else if (freq === "anual") next.setFullYear(next.getFullYear() + 1)
  else next.setMonth(next.getMonth() + 1)
  return next
}

export interface UpcomingRecurring {
  key: string
  cuenta_id: string
  categoria: string
  descripcion: string
  monto: number
  tipo: "ingreso" | "gasto"
  es_necesidad: boolean
  tags: string[]
  frequency: RecurringFrequency
  nextDate: string
  overdueDays: number
}

// Una transacción recurrente se agrupa con las demás de la misma cuenta+
// categoría+descripción+tipo; la más reciente del grupo marca el ritmo y su
// cadencia (semanal/mensual/anual, ver recurringFrequency) determina cuándo
// toca el próximo vencimiento.
export function getUpcomingRecurring(transactions: Transaction[]): UpcomingRecurring[] {
  const groups = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (!isRecurringTransaction(t) || isTransfer(t)) continue
    const key = `${t.cuenta_id}|${t.categoria}|${t.descripcion}|${t.tipo}`
    const arr = groups.get(key)
    if (arr) arr.push(t)
    else groups.set(key, [t])
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const out: UpcomingRecurring[] = []
  for (const [key, txns] of groups) {
    const last = txns.reduce((a, b) => (new Date(a.fecha) > new Date(b.fecha) ? a : b))
    const frequency = recurringFrequency(last)
    const next = addFrequency(new Date(last.fecha), frequency)
    const overdueDays = Math.round((today.getTime() - next.getTime()) / 86400000)
    out.push({
      key,
      cuenta_id: last.cuenta_id,
      categoria: last.categoria,
      descripcion: last.descripcion,
      monto: last.monto,
      tipo: last.tipo,
      es_necesidad: last.es_necesidad,
      tags: last.tags,
      frequency,
      nextDate: next.toISOString().split("T")[0],
      overdueDays,
    })
  }
  return out.sort((a, b) => a.nextDate.localeCompare(b.nextDate))
}
