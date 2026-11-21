// Email de bienvenida al activar un Pro de pago (mensual o vitalicio).
// Lógica pura, sin I/O, para poder probarla sin enviar correos.

import { asPlan, subscriptionGivesPro } from "./plans"
import type { ExistingPlan, PlanPatch } from "./webhook-plan"

export type PaidProWelcomeKind = "monthly" | "lifetime"

export type WelcomePlanLike = {
  plan?: string | null
  source?: string | null
  subscription_status?: string | null
}

export const PRO_WELCOME_FROM = "Garra <contacto@migarra.app>"
export const PRO_WELCOME_APP_URL = "https://www.migarra.app"
export const PRO_WELCOME_FEATURES =
  "Has desbloqueado cuentas ilimitadas, inversiones, el historial de patrimonio, el análisis avanzado y la exportación."

/** Clave que exige Resend para poder enviar. Si falta, no se envía nada. */
export const PRO_WELCOME_REQUIRED_ENV = "RESEND_API_KEY"

export function proWelcomeEmailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.RESEND_API_KEY)
}

export function missingProWelcomeEnv(env: Record<string, string | undefined> = process.env): string[] {
  return env.RESEND_API_KEY ? [] : [PRO_WELCOME_REQUIRED_ENV]
}

export function proWelcomeIdempotencyKey(userId: string): string {
  return `garra-pro-welcome:${userId}`
}

/** ¿El plan resultante es un Pro de pago de Stripe (mensual activo o vitalicio)? */
export function paidStripeProKind(input: WelcomePlanLike | null | undefined): PaidProWelcomeKind | null {
  if (!input || (input.source ?? "") !== "stripe") return null
  const plan = asPlan(input.plan)
  if (plan === "founder") return "lifetime"
  if (plan === "pro" && subscriptionGivesPro(input.subscription_status)) return "monthly"
  return null
}

/** Plan resultante tras un parche, sin degradar un vitalicio ya existente. */
export function resultingPlanAfterPatch(existing: ExistingPlan | WelcomePlanLike | null, patch: PlanPatch): WelcomePlanLike {
  return {
    plan: patch.plan ?? existing?.plan ?? null,
    source: patch.source ?? existing?.source ?? null,
    subscription_status: patch.subscription_status ?? (existing as WelcomePlanLike | null)?.subscription_status ?? null,
  }
}

/**
 * Solo en la primera activación de un Pro de pago. No cubre renovaciones,
 * cambios de una suscripción ya pagada ni a quien ya tiene Pro por otra vía.
 */
export function shouldClaimPaidProWelcome(input: {
  existing: WelcomePlanLike | null
  merged: WelcomePlanLike
  alreadyClaimed: boolean
}): PaidProWelcomeKind | null {
  if (input.alreadyClaimed) return null
  if (paidStripeProKind(input.existing)) return null
  return paidStripeProKind(input.merged)
}

export function buildPaidProWelcomeEmail(kind: PaidProWelcomeKind): { subject: string; text: string; html: string } {
  const lifetime = kind === "lifetime"
  const subject = lifetime ? "Gracias por pasarte a Garra Pro de por vida" : "Gracias por pasarte a Garra Pro"
  const thanks = lifetime
    ? "Gracias por pasarte a Garra Pro de por vida."
    : "Gracias por pasarte a Garra Pro."
  const manage = lifetime ? "" : "Si quieres gestionar o cancelar la suscripción, puedes hacerlo en Ajustes."
  const lines = [thanks, "", PRO_WELCOME_FEATURES, "", `Entra cuando quieras en ${PRO_WELCOME_APP_URL}.`]
  if (manage) lines.push("", manage)
  lines.push("", "Un saludo,", "Garra")
  const text = lines.join("\n")

  const manageHtml = manage ? `<p>${manage}</p>` : ""
  const html = [
    `<p>${thanks}</p>`,
    `<p>${PRO_WELCOME_FEATURES}</p>`,
    `<p>Entra cuando quieras en <a href="${PRO_WELCOME_APP_URL}">www.migarra.app</a>.</p>`,
    manageHtml,
    "<p>Un saludo,<br>Garra</p>",
  ].filter(Boolean).join("")

  return { subject, text, html }
}
