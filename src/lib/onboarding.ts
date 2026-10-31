// Guía de bienvenida (3 pasos) para usuarios nuevos. Lógica pura, sin React,
// para poder probarla.

export type OnboardingStatus = "started" | "dismissed" | "done"
export const ONBOARDING_SETTING_KEY = "onboarding"

/** Cuentas que crea la app por defecto (vacías) para un usuario nuevo. */
export const DEFAULT_ACCOUNT_IDS = new Set(["acc_emergency", "acc_ahorro", "acc_inversion", "acc_principal", "acc_gastos"])

type AccountLike = { id: string; banco?: string | null; saldo?: number | null }

/** ¿Ha creado o configurado ya alguna cuenta propia? */
export function hasOwnAccount(accounts: AccountLike[]): boolean {
  return accounts.some((a) => !DEFAULT_ACCOUNT_IDS.has(a.id) || Boolean(a.banco?.trim()) || Number(a.saldo ?? 0) !== 0)
}

export function parseOnboardingStatus(value: string | null | undefined): OnboardingStatus | null {
  return value === "started" || value === "dismissed" || value === "done" ? value : null
}

/**
 * Decide si se muestra la guía.
 *  - Nunca al administrador (Moha) ni si ya la cerró o la terminó.
 *  - Si ya estaba empezada, sigue visible hasta que la cierre.
 *  - Si no hay estado guardado, solo se muestra a cuentas vacías (sin movimientos).
 */
export function shouldShowOnboarding(input: { isAdmin: boolean; status: OnboardingStatus | null; transactionCount: number }): boolean {
  if (input.isAdmin) return false
  if (input.status === "dismissed" || input.status === "done") return false
  if (input.status === "started") return true
  return input.transactionCount === 0
}
