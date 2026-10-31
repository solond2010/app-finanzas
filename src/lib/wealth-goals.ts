import { upcomingMilestones } from "./wealth-milestones"

/** Objetivo de patrimonio de un usuario (tabla wealth_goals). */
export type WealthGoal = { id: string; amount: number; name: string | null }

export const MAX_WEALTH_GOALS = 100
export const MAX_GOAL_NAME = 40
const MAX_GOAL_AMOUNT = 100_000_000_000

/** Ordena de menor a mayor importe (y por nombre si empatan). */
export function sortGoals(goals: WealthGoal[]): WealthGoal[] {
  return goals.slice().sort((a, b) => a.amount - b.amount || (a.name ?? "").localeCompare(b.name ?? "", "es"))
}

export function cleanGoalName(name: string | null | undefined): string | null {
  const trimmed = (name ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_GOAL_NAME)
  return trimmed ? trimmed : null
}

export function isValidGoalAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= MAX_GOAL_AMOUNT
}

/** Normaliza filas de Supabase (numeric llega como string) y descarta las inválidas. */
export function parseGoalRows(rows: unknown): WealthGoal[] {
  if (!Array.isArray(rows)) return []
  const goals: WealthGoal[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const amount = Number(r.amount)
    if (typeof r.id !== "string" || !isValidGoalAmount(amount)) continue
    goals.push({ id: r.id, amount: Math.round(amount * 100) / 100, name: cleanGoalName(typeof r.name === "string" ? r.name : null) })
  }
  return sortGoals(goals)
}

/** Sugerencia para quien aún no tiene objetivos: los 5 siguientes escalones
 * por encima de su patrimonio actual (2.500 €, 5.000 €… o más si ya tiene más). */
export function suggestedGoalAmounts(netWorth: number, count = 5): number[] {
  return upcomingMilestones(Math.max(Number.isFinite(netWorth) ? netWorth : 0, 0), count)
}

export type GoalProgress = {
  /** Siguiente objetivo sin conseguir (null si no hay o están todos conseguidos). */
  next: WealthGoal | null
  /** Importe del último objetivo conseguido (0 si ninguno): punto de partida de la barra. */
  previousAmount: number
  /** 0–100 hacia el siguiente objetivo. */
  progress: number
  remaining: number
  /** Hasta `count` objetivos por conseguir, empezando por el siguiente. */
  upcoming: WealthGoal[]
  /** Recorrido de `trailSize` objetivos empezando por el último conseguido. */
  trail: WealthGoal[]
  achievedCount: number
  allDone: boolean
}

export function goalProgress(goals: WealthGoal[], netWorth: number, count = 3, trailSize = 5): GoalProgress {
  const value = Number.isFinite(netWorth) ? netWorth : 0
  const sorted = sortGoals(goals)
  const achieved = sorted.filter((g) => g.amount <= value)
  const pending = sorted.filter((g) => g.amount > value)
  const next = pending[0] ?? null
  const previousAmount = achieved.length ? achieved[achieved.length - 1].amount : 0
  const range = next ? next.amount - previousAmount : 0
  const progress = next && range > 0 ? Math.max(0, Math.min(((value - previousAmount) / range) * 100, 100)) : next ? 0 : sorted.length ? 100 : 0
  const start = Math.max(0, achieved.length - 1)
  return {
    next,
    previousAmount,
    progress,
    remaining: next ? Math.max(next.amount - value, 0) : 0,
    upcoming: pending.slice(0, count),
    trail: sorted.slice(start, start + trailSize),
    achievedCount: achieved.length,
    allDone: sorted.length > 0 && pending.length === 0,
  }
}

/** Etiqueta corta: nombre si lo tiene; si no, «Objetivo N» o «Siguiente». */
export function goalLabel(goal: WealthGoal, index: number): string {
  return goal.name ?? (index === 0 ? "Siguiente" : `Objetivo ${index + 1}`)
}

/** Lee un importe escrito a la española: «2.500», «2500», «2.500,50», «1500,5 €». */
export function parseEuroInput(text: string): number | null {
  let t = text.replace(/[€\s]/g, "")
  if (!t) return null
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".")
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "")
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const n = Number(t)
  return isValidGoalAmount(n) ? n : null
}
