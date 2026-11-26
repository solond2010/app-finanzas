// MCP y Atajo de iPhone: solo Pro (mensual, vitalicio o en prueba),
// salvo quien ya los tuviera conectados o en uso antes del corte.
// El abuelo se deduce de filas ya existentes y su created_at, sin marcar
// ni escribir nada en la base de datos, y sin revocar tokens.

import { isLifetimeAccess, isPaid, subscriptionGivesPro, type Plan } from "./plans"

/** 26 nov 2026 18:00, hora de Madrid (UTC+1). Tras publicar, un gratis nuevo
 * no puede crear tokens; esta hora cubre el desfase entre instancias. */
export const CONNECTORS_PRO_CUTOFF_UTC = "2026-11-26T17:00:00.000Z"

export const CONNECTORS_PRO_NOTICE = "Solo en Pro"
export const CONNECTORS_PRO_ERROR = "Solo en Pro. Si ya la usabas, sigue disponible."
export const CONNECTORS_PRO_HREF = "/precios"

export function hasProConnectorPlan(
  plan: Plan | null | undefined,
  source?: string | null,
  subscriptionStatus?: string | null,
): boolean {
  const resolved = plan ?? "free"
  return isPaid(resolved) || isLifetimeAccess(resolved, source) || subscriptionGivesPro(subscriptionStatus)
}

/** Hay rastro de uso o conexión anterior al corte (tokens, grants o movimientos). */
/** Filtro PostgREST cs= para un array jsonb, p. ej. tags. */
export function jsonArrayContains(value: string): string {
  return JSON.stringify([value])
}

export function hasLegacyConnectorEvidence(
  createdAtList: Array<string | null | undefined>,
  cutoff: string | number = CONNECTORS_PRO_CUTOFF_UTC,
): boolean {
  const cut = typeof cutoff === "number" ? cutoff : Date.parse(cutoff)
  if (!Number.isFinite(cut)) return false
  return createdAtList.some((value) => {
    if (!value) return false
    const t = Date.parse(value)
    return Number.isFinite(t) && t < cut
  })
}

export function canUseConnectors(input: {
  paymentsEnabled: boolean
  plan?: Plan | null
  source?: string | null
  subscriptionStatus?: string | null
  evidenceCreatedAt?: Array<string | null | undefined>
  cutoff?: string | number
}): boolean {
  if (!input.paymentsEnabled) return true
  if (hasProConnectorPlan(input.plan, input.source, input.subscriptionStatus)) return true
  return hasLegacyConnectorEvidence(input.evidenceCreatedAt ?? [], input.cutoff ?? CONNECTORS_PRO_CUTOFF_UTC)
}
