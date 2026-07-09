import type { Account, Transaction, MonthlySummary, NetWorthSnapshot, SinkingFund } from "./store"
import { convertToEur } from "./currency"

/**
 * Objetivo efectivo de una cuenta: el que tenga puesto directamente en la
 * cuenta, o si no tiene, la suma de los objetivos de las metas de ahorro
 * vinculadas a ella (cuenta_id). Sin esto, vincular una cuenta a una meta en
 * "Metas de ahorro" no hacía aparecer ninguna barra de progreso en las
 * tarjetas/widgets de esa cuenta, porque son dos campos independientes.
 */
export function accountGoal(account: Account, sinkingFunds: SinkingFund[]): number {
  if (account.objetivo && account.objetivo > 0) return account.objetivo
  return sinkingFunds.filter((f) => f.cuenta_id === account.id).reduce((s, f) => s + f.cantidad_objetivo, 0)
}

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

export function getNeedsVsWantsForMonth(transactions: Transaction[], monthKey?: string) {
  const monthTransactions = filterTransactionsByMonth(transactions, monthKey).filter((t) => t.tipo === "gasto" && !isTransfer(t))
  const necesidades = monthTransactions.filter((t) => t.es_necesidad).reduce((s, t) => s + t.monto, 0)
  const deseos = monthTransactions.filter((t) => !t.es_necesidad).reduce((s, t) => s + t.monto, 0)
  return { necesidades, deseos }
}

function getNetWorth(accounts: Account[]): number {
  return accounts.reduce((sum, a) => sum + convertToEur(a.saldo, a.currency), 0)
}

// Agrupa las transacciones por cuenta una sola vez (O(n)). Los "historial de
// patrimonio" de abajo llaman a las funciones de más abajo una vez POR MES/DÍA
// del rango visible (hasta 24-30 veces); sin agrupar antes, cada una de esas
// llamadas recorría accounts.map() × transactions.filter() entero — con años
// de histórico eso son cientos de miles de comparaciones en cada render tras
// añadir un solo movimiento. Agrupando antes, cada llamada solo recorre la
// porción de transacciones de cada cuenta, no el histórico completo.
function groupByAccount(transactions: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const arr = map.get(t.cuenta_id)
    if (arr) arr.push(t)
    else map.set(t.cuenta_id, [t])
  }
  return map
}

function accountsWithDelta(accounts: Account[], txByAccount: Map<string, Transaction[]>, isFuture: (t: Transaction) => boolean) {
  return accounts.map((account) => {
    const accountTxs = txByAccount.get(account.id)
    let balanceDelta = 0
    if (accountTxs) {
      for (const t of accountTxs) if (isFuture(t)) balanceDelta += transactionDelta(t)
    }
    return { ...account, saldo: account.saldo - balanceDelta }
  })
}

export function getAccountsAtMonth(accounts: Account[], transactions: Transaction[], monthKey?: string) {
  if (!monthKey) return accounts
  return accountsWithDelta(accounts, groupByAccount(transactions), (t) => isAfterMonth(t.fecha, monthKey))
}

export function getNetWorthAtMonth(accounts: Account[], transactions: Transaction[], monthKey?: string) {
  return getNetWorth(getAccountsAtMonth(accounts, transactions, monthKey))
}

// Variantes para llamadores que necesitan getNetWorthAtMonth en un bucle
// (un punto por mes de un rango de hasta 24 meses, como el gráfico de
// evolución del Dashboard): agrupar las transacciones una vez fuera del
// bucle y reutilizar el mapa evita repetir el agrupado O(n) en cada mes.
export function groupTransactionsByAccount(transactions: Transaction[]): Map<string, Transaction[]> {
  return groupByAccount(transactions)
}

export function getNetWorthAtMonthFromGroups(accounts: Account[], txByAccount: Map<string, Transaction[]>, monthKey?: string) {
  if (!monthKey) return getNetWorth(accounts)
  return getNetWorth(accountsWithDelta(accounts, txByAccount, (t) => isAfterMonth(t.fecha, monthKey)))
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

function getAccountsAtDate(accounts: Account[], txByAccount: Map<string, Transaction[]>, dateKey: string) {
  return accountsWithDelta(accounts, txByAccount, (t) => isAfterDate(t.fecha, dateKey))
}

function getNetWorthAtDate(accounts: Account[], txByAccount: Map<string, Transaction[]>, dateKey: string) {
  return getNetWorth(getAccountsAtDate(accounts, txByAccount, dateKey))
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
  const txByAccount = groupByAccount(transactions)
  // Igual que txByAccount: agrupar por día una vez evita recorrer todas las
  // transacciones en cada una de las `days` iteraciones del bucle de abajo.
  const txByDateKey = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const key = toDateKey(new Date(t.fecha))
    const arr = txByDateKey.get(key)
    if (arr) arr.push(t)
    else txByDateKey.set(key, [t])
  }
  const points: NetWorthSnapshot[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - (days - 1 - i))
    const dateKey = toDateKey(d)
    const dayLabel = d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
    const dayEnd = getNetWorthAtDate(accounts, txByAccount, dateKey)
    const todaysTransactions = txByDateKey.get(dateKey) ?? []
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

function getNetWorthAtMoment(accounts: Account[], txByAccount: Map<string, Transaction[]>, dateKey: string, createdAt: string) {
  return getNetWorth(accountsWithDelta(accounts, txByAccount, (t) => isAfterMoment(t, dateKey, createdAt)))
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

  const txByAccount = groupByAccount(transactions)
  const points: NetWorthSnapshot[] = [{ mes: "Inicio", patrimonio: getNetWorthAtDate(accounts, txByAccount, yesterdayKey) }]
  for (const t of todaysTransactions) {
    const label = t.created_at ? new Date(t.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—"
    points.push({ mes: label, patrimonio: getNetWorthAtMoment(accounts, txByAccount, todayKey, t.created_at ?? "") })
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

export interface CategoryInsight {
  categoria: string
  current: number
  average: number
  deltaPct: number
  deltaAbs: number
  /** Sin gasto ninguno de los 5 meses anteriores: es una categoría nueva, no una subida. */
  isNew: boolean
}

// Umbral mínimo en € para no destacar ruido en categorías de poco gasto
// (ej. "Regalos" pasando de 3€ a 9€ es un 200% pero es irrelevante), y
// variación mínima en % para no destacar fluctuaciones normales mes a mes.
const INSIGHT_MIN_AMOUNT = 20
const INSIGHT_MIN_PCT = 15

/**
 * Compara el gasto por categoría del mes seleccionado contra la media de los
 * 5 meses anteriores (misma ventana de 6 meses que buildMonthlyCashFlow), y
 * devuelve las mayores desviaciones — para la tarjeta "Lo que ha cambiado
 * este mes" de Analíticas.
 */
export function getCategoryInsights(transactions: Transaction[], selectedMonth: string, maxInsights = 3): CategoryInsight[] {
  const window = getMonthWindow(selectedMonth, 6)
  const currentMonth = window[window.length - 1]
  const priorMonths = window.slice(0, -1)

  const currentBreakdown = new Map(getCategoryBreakdown(transactions, currentMonth).map((c) => [c.categoria, c.monto]))

  const priorTotals = new Map<string, number>()
  for (const m of priorMonths) {
    for (const c of getCategoryBreakdown(transactions, m)) {
      priorTotals.set(c.categoria, (priorTotals.get(c.categoria) ?? 0) + c.monto)
    }
  }

  const categorias = new Set([...currentBreakdown.keys(), ...priorTotals.keys()])
  const insights: CategoryInsight[] = []
  for (const categoria of categorias) {
    const current = currentBreakdown.get(categoria) ?? 0
    const average = (priorTotals.get(categoria) ?? 0) / (priorMonths.length || 1)
    if (current < INSIGHT_MIN_AMOUNT && average < INSIGHT_MIN_AMOUNT) continue

    const deltaAbs = current - average
    const isNew = average === 0 && current > 0
    const deltaPct = average > 0 ? (deltaAbs / average) * 100 : 100
    if (!isNew && Math.abs(deltaPct) < INSIGHT_MIN_PCT) continue

    insights.push({ categoria, current, average, deltaPct, deltaAbs, isNew })
  }

  return insights.sort((a, b) => Math.abs(b.deltaAbs) - Math.abs(a.deltaAbs)).slice(0, maxInsights)
}

export interface FinancialScoreFactor {
  label: string
  ok: boolean
}

export interface FinancialScoreResult {
  score: number
  tier: { label: string; color: string }
  factors: FinancialScoreFactor[]
}

/**
 * Puntuación financiera (0-100) de la tarjeta "Puntuación financiera" del
 * Dashboard: cuatro factores ponderados. Los dos factores de flujo/crecimiento
 * usan una zona de transición (en vez de un corte seco en 0) para que un único
 * movimiento pequeño no dispare la puntuación de golpe ±20 puntos.
 */
export function getFinancialScore(params: {
  savingsRate: number
  monthlyNeto: number
  netWorthCurrent: number
  netWorthBaseline: number
  hasActiveEmergencyFund: boolean
}): FinancialScoreResult {
  const { savingsRate, monthlyNeto, netWorthCurrent, netWorthBaseline, hasActiveEmergencyFund } = params

  let s = 0
  s += (Math.max(0, Math.min(savingsRate, 30)) / 30) * 40
  s += Math.max(0, Math.min(1, (monthlyNeto + 100) / 200)) * 20
  const growthPct = netWorthBaseline > 0 ? ((netWorthCurrent - netWorthBaseline) / netWorthBaseline) * 100 : netWorthCurrent > 0 ? 100 : 0
  s += Math.max(0, Math.min(1, (growthPct + 2) / 4)) * 20
  if (hasActiveEmergencyFund) s += 20
  const score = Math.round(Math.max(0, Math.min(100, s)))

  const tier =
    score >= 80 ? { label: "Excelente", color: "var(--accent-green)" }
    : score >= 60 ? { label: "Sólido", color: "var(--accent-blue)" }
    : score >= 40 ? { label: "Mejorable", color: "var(--accent-amber)" }
    : { label: "Frágil", color: "var(--accent-red)" }

  const factors: FinancialScoreFactor[] = [
    { label: "Tasa de ahorro ≥ 20%", ok: savingsRate >= 20 },
    { label: "Flujo del mes positivo", ok: monthlyNeto > 0 },
    { label: "Patrimonio en crecimiento", ok: netWorthCurrent > netWorthBaseline },
    { label: "Fondo de emergencia activo", ok: hasActiveEmergencyFund },
  ]

  return { score, tier, factors }
}

export function calculateMonthlySaving(amountTarget: number, current: number, deadline: string): number {
  const now = new Date()
  const end = new Date(deadline)
  const monthsLeft = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
  if (monthsLeft <= 0) return 0
  return Math.round((amountTarget - current) / monthsLeft)
}

// Etiqueta corta de mes para ejes de gráficos ("jul 26").
function formatMonth(d: Date) {
  return d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" })
}

export function buildMonthlySummariesUpTo(transactions: Transaction[], endMonthKey?: string, monthCount = 6): MonthlySummary[] {
  return getMonthWindow(endMonthKey, monthCount).map((month) => {
    const { ingresos, gastos } = getMonthTotalsByString(transactions, month)
    return { mes: formatMonth(parseMonthKey(month)), ingresos, gastos }
  })
}

export function buildMonthlyCashFlow(transactions: Transaction[], endMonthKey?: string, monthCount = 6): { mes: string; ingresos: number; gastos: number; neto: number }[] {
  return getMonthWindow(endMonthKey, monthCount).map((month) => {
    const { ingresos, gastos, neto } = getMonthTotalsByString(transactions, month)
    return { mes: formatMonth(parseMonthKey(month)), ingresos, gastos, neto }
  })
}

export function buildNetWorthHistory(transactions: Transaction[], accounts: Account[], endMonthKey?: string, monthCount = 6): NetWorthSnapshot[] {
  // Agrupar una vez fuera del bucle: getNetWorthAtMonth por sí sola ya agrupa
  // internamente, pero llamada hasta 24 veces (una por mes de la ventana)
  // repetiría el agrupado 24 veces sobre el mismo array si no se reutiliza.
  const txByAccount = groupByAccount(transactions)
  return getMonthWindow(endMonthKey, monthCount).map((month) => ({
    mes: formatMonth(parseMonthKey(month)),
    patrimonio: getNetWorth(accountsWithDelta(accounts, txByAccount, (t) => isAfterMonth(t.fecha, month))),
  }))
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
  sourceTransactionId: string
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
      sourceTransactionId: last.id,
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
