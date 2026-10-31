import type { Account, Transaction } from "@/lib/store"
import { countsTowardCashFlow } from "@/lib/calculations"

export type LimitLevel = "ok" | "near" | "over"

export interface MonthlyLimitStatus {
  limit: number
  spent: number
  /** Porcentaje usado, sin tope (puede pasar de 100). */
  pct: number
  remaining: number
  over: number
  level: LimitLevel
}

export const NEAR_LIMIT_PCT = 80

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/**
 * «Límite mensual» de una cuenta: lo gastado este mes natural en esa cuenta
 * (sin traspasos) frente al tope. null si la cuenta no tiene límite.
 */
export function monthlyLimitStatus(
  account: Pick<Account, "id" | "limite_mensual">,
  transactions: Transaction[],
  now = new Date(),
): MonthlyLimitStatus | null {
  const limit = Number(account.limite_mensual)
  if (!Number.isFinite(limit) || limit <= 0) return null
  const mes = monthKey(now)
  const spent = transactions
    .filter((t) => t.cuenta_id === account.id && t.fecha.startsWith(mes) && t.tipo === "gasto" && countsTowardCashFlow(t, transactions))
    .reduce((s, t) => s + Math.abs(t.monto), 0)
  const pct = (spent / limit) * 100
  return {
    limit,
    spent,
    pct,
    remaining: Math.max(limit - spent, 0),
    over: Math.max(spent - limit, 0),
    level: spent > limit ? "over" : pct >= NEAR_LIMIT_PCT ? "near" : "ok",
  }
}

const RANK: Record<LimitLevel, number> = { ok: 0, near: 1, over: 2 }

/** true si el estado empeora (ok→cerca, cerca→pasado, ok→pasado). */
export function limitWorsened(before: LimitLevel | undefined, after: LimitLevel): boolean {
  return before !== undefined && RANK[after] > RANK[before]
}
