import type { Account, Transaction, MonthlySummary, NetWorthSnapshot, SinkingFund } from "./store"
import { convertToEur } from "./currency"
import type { Position } from "./investments"

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

// El campo ahorrado_actual guardado en la meta es solo una foto fija del día
// en que se creó/editó — no se actualizaba sola con cada ingreso/gasto/
// traspaso de la cuenta vinculada. Como esa cuenta es obligatoria al crear la
// meta, el saldo real de la cuenta es siempre la fuente de verdad; el campo
// guardado solo sirve de respaldo si la cuenta llegó a borrarse.
export function fundCurrentAmount(fund: SinkingFund, accounts: Account[]): number {
  const account = accounts.find((a) => a.id === fund.cuenta_id)
  return account ? account.saldo : fund.ahorrado_actual
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
      points.push({ mes: `${dayLabel} · pico`, patrimonio: dayEnd + outflow, date: dateKey })
    }
    points.push({ mes: dayLabel, patrimonio: dayEnd, date: dateKey })
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
  const points: NetWorthSnapshot[] = [{ mes: "Inicio", patrimonio: getNetWorthAtDate(accounts, txByAccount, yesterdayKey), date: yesterdayKey }]
  for (const t of todaysTransactions) {
    const label = t.created_at ? new Date(t.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—"
    points.push({ mes: label, patrimonio: getNetWorthAtMoment(accounts, txByAccount, todayKey, t.created_at ?? ""), date: todayKey })
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

export interface FinancialTip {
  id: string
  severity: "critical" | "warning" | "info"
  message: string
}

const SEVERITY_RANK: Record<FinancialTip["severity"], number> = { critical: 0, warning: 1, info: 2 }
const GOAL_DEADLINE_SOON_DAYS = 30
const RECURRING_DUE_SOON_DAYS = 3

/**
 * Motor de consejos basado en reglas deterministas sobre los propios datos
 * (sin IA ni servicio externo — nada que mantener ni que deje de ser gratis).
 * Cada regla es una comprobación pequeña y aislada; se devuelven las de mayor
 * severidad primero, como máximo `maxTips`.
 */
export function getFinancialTips(
  transactions: Transaction[],
  accounts: Account[],
  sinkingFunds: SinkingFund[],
  selectedMonth?: string,
  maxTips = 4
): FinancialTip[] {
  const tips: FinancialTip[] = []
  const monthKey = selectedMonth ?? getMonthKey(new Date())
  const monthTotals = getMonthTotalsByString(transactions, monthKey)
  const savingsRate = getSavingsRate(monthTotals.ingresos, monthTotals.neto)

  if (monthTotals.neto < 0) {
    tips.push({ id: "cashflow-negative", severity: "critical", message: `Este mes vas negativo: revisa tus gastos más grandes antes de que se acumule más.` })
  }

  if (monthTotals.ingresos > 0 && savingsRate < 20) {
    tips.push({ id: "low-savings-rate", severity: "warning", message: `Tu tasa de ahorro este mes es del ${Math.round(savingsRate)}%, por debajo del 20% recomendado.` })
  }

  const netWorthWindow = buildNetWorthHistory(transactions, accounts, selectedMonth, 3)
  if (netWorthWindow.length === 3 && netWorthWindow.every((m) => m.patrimonio !== 0) && netWorthWindow[2].patrimonio <= netWorthWindow[0].patrimonio) {
    tips.push({ id: "net-worth-stagnant", severity: "info", message: "Tu patrimonio lleva 3 meses sin crecer. Revisa si puedes automatizar algún ahorro." })
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]))
  for (const item of getUpcomingRecurring(transactions)) {
    if (item.tipo !== "gasto" || item.overdueDays < -RECURRING_DUE_SOON_DAYS) continue
    const account = accountById.get(item.cuenta_id)
    if (account && account.saldo < item.monto) {
      tips.push({ id: `recurring-risk-${item.key}`, severity: "critical", message: `"${item.descripcion || item.categoria}" vence pronto y tu cuenta ${account.nombre} no llega para cubrirlo.` })
    }
  }

  for (const fund of sinkingFunds) {
    if (fundCurrentAmount(fund, accounts) >= fund.cantidad_objetivo) continue
    const daysLeft = (new Date(fund.fecha_limite).getTime() - Date.now()) / 86400000
    if (daysLeft > 0 && daysLeft <= GOAL_DEADLINE_SOON_DAYS) {
      tips.push({ id: `goal-deadline-${fund.id}`, severity: "warning", message: `Tu meta "${fund.nombre}" vence en menos de un mes y todavía no está completa.` })
    }
  }

  return tips.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]).slice(0, maxTips)
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

  return out
}

// ============================================================
// CÁLCULO PRECISO DEL HISTORIAL DE PATRIMONIO
// ============================================================
// Reconstruye el patrimonio exacto en cada fecha usando:
// 1. Saldo real de cuentas de inversión (traspasos "traspaso")
// 2. Unidades reales de cada posición (fecha de compra) × precio histórico
// ============================================================

export interface PreciseNetWorthPoint {
  date: string        // YYYY-MM-DD
  label: string       // Etiqueta para gráfico
  patrimonio: number  // €
  breakdown: {
    cash: number              // Cuentas no-inversión
    investedCash: number      // Efectivo en cuentas inversión (saldo - coste posiciones)
    portfolioValue: number    // Valor de mercado de posiciones
  }
}

/**
 * Calcula el patrimonio neto preciso para un rango de fechas.
 * @param accounts Cuentas actuales
 * @param transactions Todas las transacciones
 * @param positions Posiciones actuales (con fecha de compra)
 * @param priceHistory Histórico de precios { symbol: [{ t: timestamp, c: price }] }
 * @param days Número de días hacia atrás desde endDate
 * @param endDate Fecha final (por defecto hoy)
 * @returns Array de puntos diarios con patrimonio preciso
 */
export function buildPreciseNetWorthHistory(
  accounts: Account[],
  transactions: Transaction[],
  positions: Position[],
  priceHistory: Record<string, { t: number; c: number }[]>,
  days: number,
  endDate = new Date()
): PreciseNetWorthPoint[] {
  // 1. Agrupar transacciones por cuenta
  const txByAccount = groupByAccount(transactions)
  
  // 2. Identificar cuentas de inversión
  const investAccountIds = new Set(accounts.filter((a) => a.tipo === "inversion").map((a) => a.id))
  
  // 3. Para cada posición, obtener su cuenta de inversión
  const positionByAccount = new Map<string, Position[]>()
  for (const p of positions) {
    if (p.accountId && investAccountIds.has(p.accountId)) {
      const arr = positionByAccount.get(p.accountId) ?? []
      arr.push(p)
      positionByAccount.set(p.accountId, arr)
    }
  }
  
  // 4. Para cada cuenta de inversión, obtener traspasos ordenados por fecha
  const transfersByAccount = new Map<string, Transaction[]>()
  for (const accountId of investAccountIds) {
    const accountTxs = txByAccount.get(accountId) ?? []
    const transfers = accountTxs
      .filter((t) => isTransfer(t))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    if (transfers.length > 0) transfersByAccount.set(accountId, transfers)
  }
  
  // 5. Para cada posición, ordenar por fecha de compra
  const positionsSorted = [...positions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  // 6. Función helper: precio de un símbolo en una fecha
  const getPriceAt = (symbol: string, atDate: Date, fallbackBuyPrice: number): number => {
    const hist = priceHistory[symbol]
    if (!hist || hist.length === 0) return fallbackBuyPrice
    const atMs = atDate.getTime()
    let best: { t: number; c: number } | null = null
    for (const point of hist) {
      const pointMs = point.t * 1000
      if (pointMs <= atMs && (!best || pointMs > best.t * 1000)) best = point
    }
    return best?.c ?? fallbackBuyPrice
  }
  
  // 7. Generar puntos diarios
  const points: PreciseNetWorthPoint[] = []
  
  for (let i = 0; i < days; i++) {
    const d = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - (days - 1 - i))
    const dateKey = toDateKey(d)
    const label = d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
    
    // --- CASH: cuentas NO inversión ---
    let cash = 0
    for (const account of accounts) {
      if (investAccountIds.has(account.id)) continue
      // Calcular saldo a fecha
      const accountTxs = txByAccount.get(account.id) ?? []
      let balance = account.saldo
      for (const t of accountTxs) {
        if (new Date(t.fecha) > d) balance -= transactionDelta(t)
      }
      cash += convertToEur(balance, account.currency)
    }
    
    // --- CUENTAS DE INVERSIÓN ---
    let investedCash = 0
    let portfolioValue = 0
    
    for (const accountId of investAccountIds) {
      const account = accounts.find((a) => a.id === accountId)
      if (!account) continue
      
      // Saldo base de la cuenta (sin posiciones)
      const accountTxs = txByAccount.get(accountId) ?? []
      let balance = account.saldo
      for (const t of accountTxs) {
        if (new Date(t.fecha) > d) balance -= transactionDelta(t)
      }
      
      // Restar coste de posiciones compradas hasta esta fecha
      const accountPositions = positionByAccount.get(accountId) ?? []
      let investedCost = 0
      for (const p of accountPositions) {
        if (new Date(p.date) <= d) {
          investedCost += p.units * p.buyPrice
        }
      }
      
      // Efectivo en la cuenta = saldo - coste posiciones
      const cashInAccount = balance - investedCost
      investedCash += cashInAccount
      
      // Valor de cartera = sum(units * precio histórico) para posiciones compradas hasta esta fecha
      for (const p of accountPositions) {
        if (new Date(p.date) <= d) {
          const price = getPriceAt(p.symbol, d, p.buyPrice)
          portfolioValue += p.units * price
        }
      }
    }
    
    const patrimonio = cash + investedCash + portfolioValue
    
    points.push({
      date: dateKey,
      label,
      patrimonio,
      breakdown: { cash, investedCash, portfolioValue }
    })
  }
  
  return points
}

/**
 * Diagnóstico del cálculo de patrimonio: identifica posibles problemas
 * (precios faltantes, posiciones sin fecha, traspasos sin etiquetar, etc.)
 */
export function diagnoseNetWorthCalculation(
  accounts: Account[],
  transactions: Transaction[],
  positions: Position[],
  priceHistory: Record<string, { t: number; c: number }[]>
): { warnings: string[]; info: string[] } {
  const warnings: string[] = []
  const info: string[] = []
  
  const investAccountIds = new Set(accounts.filter((a) => a.tipo === "inversion").map((a) => a.id))
  
  // 1. Cuentas de inversión sin traspasos etiquetados
  const txByAccount = groupByAccount(transactions)
  for (const accountId of investAccountIds) {
    const accountTxs = txByAccount.get(accountId) ?? []
    const transfers = accountTxs.filter((t) => isTransfer(t))
    if (transfers.length === 0) {
      const account = accounts.find((a) => a.id === accountId)
      if (account) warnings.push(`Cuenta "${account.nombre}" (inversión) no tiene traspasos etiquetados "traspaso". El saldo histórico será incorrecto.`)
    }
  }
  
  // 2. Posiciones sin accountId
  const positionsWithoutAccount = positions.filter((p) => !p.accountId)
  if (positionsWithoutAccount.length > 0) {
    warnings.push(`${positionsWithoutAccount.length} posición(es) sin accountId: no se asignarán a ninguna cuenta de inversión.`)
  }
  
  // 3. Posiciones con fecha de compra futura o inválida
  const now = new Date()
  const invalidDatePositions = positions.filter((p) => {
    const d = new Date(p.date)
    return isNaN(d.getTime()) || d > now
  })
  if (invalidDatePositions.length > 0) {
    warnings.push(`${invalidDatePositions.length} posición(es) con fecha de compra inválida/futura.`)
  }
  
  // 4. Símbolos sin histórico de precios
  const symbolsNeeded = new Set(positions.filter((p) => p.kind !== "custom").map((p) => p.symbol))
  const symbolsMissing = [...symbolsNeeded].filter((s) => !priceHistory[s] || priceHistory[s].length === 0)
  if (symbolsMissing.length > 0) {
    warnings.push(`Símbolos sin histórico de precios (se usará buyPrice como fallback): ${symbolsMissing.join(", ")}`)
  }
  
  // 5. Histórico de precios muy corto
  for (const [symbol, hist] of Object.entries(priceHistory)) {
    if (hist.length > 0) {
      const oldest = new Date(hist[0].t * 1000)
      const newest = new Date(hist[hist.length - 1].t * 1000)
      const days = (newest.getTime() - oldest.getTime()) / 86400000
      if (days < 365) {
        info.push(`Histórico de ${symbol}: solo ${days.toFixed(0)} días (${oldest.toLocaleDateString()} - ${newest.toLocaleDateString()})`)
      }
    }
  }
  
  // 6. Primera transacción
  if (transactions.length > 0) {
    const firstTx = transactions.reduce((oldest, t) => new Date(t.fecha) < new Date(oldest.fecha) ? t : oldest)
    info.push(`Primera transacción: ${firstTx.fecha} (${firstTx.tipo} ${firstTx.monto}€ en ${firstTx.categoria})`)
  }
  
  return { warnings, info }
}

/**
 * Versión mensual: devuelve un punto por mes (cierre de mes)
 */
export function buildPreciseNetWorthHistoryMonthly(
  accounts: Account[],
  transactions: Transaction[],
  positions: Position[],
  priceHistory: Record<string, { t: number; c: number }[]>,
  months: number,
  endMonthKey?: string
): PreciseNetWorthPoint[] {
  const end = endMonthKey ? parseMonthKey(endMonthKey) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const points: PreciseNetWorthPoint[] = []
  
  for (let i = 0; i < months; i++) {
    const d = new Date(end.getFullYear(), end.getMonth() - (months - 1 - i), 1)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const monthKey = getMonthKey(d)
    
    // Usar la versión diaria para el último día del mes
    const daily = buildPreciseNetWorthHistory(accounts, transactions, positions, priceHistory, 1, monthEnd)
    const point = daily[0]
    
    points.push({
      ...point,
      label: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
      date: monthKey
    })
  }
  
  return points
}
