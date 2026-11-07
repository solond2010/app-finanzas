import { localDateKey, parseLocalDate } from "./date-utils"

export type InterestFrequency = "daily" | "monthly" | "quarterly" | "semiannual" | "annual"

export const INTEREST_FREQUENCIES: { value: InterestFrequency; label: string; months: number }[] = [
  { value: "daily", label: "Diario", months: 0 },
  { value: "monthly", label: "Mensual", months: 1 },
  { value: "quarterly", label: "Trimestral", months: 3 },
  { value: "semiannual", label: "Semestral", months: 6 },
  { value: "annual", label: "Anual", months: 12 },
]

export function interestFrequencyLabel(value: string | null | undefined): string {
  return INTEREST_FREQUENCIES.find((item) => item.value === value)?.label ?? "Selecciona la frecuencia"
}

export type RemuneratedAccountForecast = {
  eligibleBalance: number
  dailyInterest: number
  thirtyDayInterest: number
  accruedInterest: number
  accruedDays: number
  accrualDate: string | null
  nextPaymentDate: string | null
}

function shiftDate(dateKey: string, days: number): string {
  const date = parseLocalDate(dateKey)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

function daysBetween(start: string, end: string): number {
  const startDate = parseLocalDate(start)
  const endDate = parseLocalDate(end)
  const startUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const endUtc = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
  return Math.floor((endUtc - startUtc) / 86_400_000)
}

/** Shift from the original anchor so an end-of-month payment does not drift over time. */
function shiftMonthsFromAnchor(dateKey: string, months: number): string {
  const anchor = parseLocalDate(dateKey)
  const day = anchor.getDate()
  const shifted = new Date(anchor.getFullYear(), anchor.getMonth() + months, 1)
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate()
  shifted.setDate(Math.min(day, lastDay))
  return localDateKey(shifted)
}

export function calculateRemuneratedAccountForecast({
  balance,
  annualTae,
  frequency,
  startDate,
  lastPaymentDate,
  balanceCap,
  today = new Date(),
}: {
  balance: number
  annualTae: number
  frequency: InterestFrequency
  startDate?: string | null
  lastPaymentDate?: string | null
  balanceCap?: number | null
  today?: Date
}): RemuneratedAccountForecast {
  const safeBalance = Number.isFinite(balance) ? Math.max(0, balance) : 0
  const safeCap = balanceCap != null && Number.isFinite(balanceCap) && balanceCap > 0 ? balanceCap : Number.POSITIVE_INFINITY
  const eligibleBalance = Math.min(safeBalance, safeCap)
  const dailyFactor = Math.pow(1 + Math.min(100, Math.max(0, Number.isFinite(annualTae) ? annualTae : 0)) / 100, 1 / 365)
  const dailyInterest = eligibleBalance * (dailyFactor - 1)
  const thirtyDayInterest = eligibleBalance * (Math.pow(dailyFactor, 30) - 1)
  const todayKey = localDateKey(today)
  const accrualDate = lastPaymentDate || startDate || null
  const accruedDays = accrualDate ? Math.max(0, daysBetween(accrualDate, todayKey)) : 0
  const accruedInterest = eligibleBalance * (Math.pow(dailyFactor, accruedDays) - 1)

  let nextPaymentDate: string | null = null
  if (accrualDate) {
    const option = INTEREST_FREQUENCIES.find((item) => item.value === frequency)
    if (option?.months === 0) {
      nextPaymentDate = shiftDate(accrualDate, Math.max(1, accruedDays + 1))
    } else if (option) {
      let cycle = 1
      nextPaymentDate = shiftMonthsFromAnchor(accrualDate, option.months * cycle)
      while (nextPaymentDate <= todayKey && cycle < 1_000) {
        cycle += 1
        nextPaymentDate = shiftMonthsFromAnchor(accrualDate, option.months * cycle)
      }
    }
  }

  return { eligibleBalance, dailyInterest, thirtyDayInterest, accruedInterest, accruedDays, accrualDate, nextPaymentDate }
}

export function formatForecastDate(dateKey: string | null): string {
  if (!dateKey) return "Sin fecha configurada"
  const date = parseLocalDate(dateKey)
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(date).replace(/\.$/, "")
}
