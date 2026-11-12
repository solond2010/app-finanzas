// Avisos del Inicio que se pueden cerrar hasta el mes siguiente (Europe/Madrid).
// La persistencia (nube + local) vive en use-dismiss-for-month.ts.

import { dateKeyInTimeZone } from "@/lib/date-utils"

export const PACE_BANNER_SETTING = "dashboard-pace-banner-dismissed"
export const MONTHLY_SUMMARY_SETTING = "dashboard-monthly-summary-dismissed"
export const MADRID_TZ = "Europe/Madrid"

/** Mes calendario actual en Europe/Madrid, como YYYY-MM. */
export function madridMonthKey(now = new Date()): string {
  return dateKeyInTimeZone(now, MADRID_TZ).slice(0, 7)
}

/** Clave de localStorage, acotada al usuario para no mezclar cuentas en el mismo aparato. */
export function dismissStorageKey(settingKey: string, userId: string): string {
  return `garra:${settingKey}:${userId}`
}

/**
 * Un aviso cerrado se guarda como el YYYY-MM en que se cerró.
 * Sigue oculto mientras el mes de Madrid sea ese; al cambiar de mes, reaparece.
 */
export function isDismissedThisMonth(stored: string | null | undefined, currentMonth = madridMonthKey()): boolean {
  if (!stored) return false
  const key = stored.trim().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(key)) return false
  return key === currentMonth
}

/** «Octubre 2026» → «Resumen de octubre». */
export function monthlySummaryHeading(label: string): string {
  const month = label.replace(/\s+\d{4}$/, "").trim().toLowerCase()
  return month ? `Resumen de ${month}` : "Resumen mensual"
}

/** Avisos reales de «Lo importante hoy». Nunca incluye el coach del colchón / siguiente paso. */
export function importantTodayKinds(flags: { upcomingFixed: boolean; unusualOrBudget: boolean }): Array<"fijo" | "dispara"> {
  const kinds: Array<"fijo" | "dispara"> = []
  if (flags.upcomingFixed) kinds.push("fijo")
  if (flags.unusualOrBudget) kinds.push("dispara")
  return kinds
}
