import { describe, expect, it } from "vitest"
import {
  CONNECTORS_PRO_CUTOFF_UTC,
  canUseConnectors,
  hasLegacyConnectorEvidence,
  hasProConnectorPlan,
} from "./connectors-access"

const beforeCutoff = "2026-11-26T16:59:59.999Z"
const atCutoff = CONNECTORS_PRO_CUTOFF_UTC
const afterCutoff = "2026-11-26T17:00:00.001Z"

describe("acceso al MCP y al Atajo", () => {
  it("da acceso a Pro mensual, vitalicio, trialing y derechos de por vida", () => {
    expect(hasProConnectorPlan("pro", "stripe", "active")).toBe(true)
    expect(hasProConnectorPlan("founder", "stripe", null)).toBe(true)
    expect(hasProConnectorPlan("pro", "stripe", "trialing")).toBe(true)
    expect(hasProConnectorPlan("free", "first_fifty", null)).toBe(true)
    expect(hasProConnectorPlan("free", "early_access", null)).toBe(true)
    expect(hasProConnectorPlan("free", "admin_grant", null)).toBe(true)
    expect(hasProConnectorPlan("free", "stripe", null)).toBe(false)
    expect(hasProConnectorPlan("free", null, "canceled")).toBe(false)
  })

  it("deduce el abuelo de fechas ya existentes, sin marcar nada", () => {
    expect(hasLegacyConnectorEvidence([beforeCutoff])).toBe(true)
    expect(hasLegacyConnectorEvidence([atCutoff])).toBe(false)
    expect(hasLegacyConnectorEvidence([afterCutoff])).toBe(false)
    expect(hasLegacyConnectorEvidence([afterCutoff, beforeCutoff])).toBe(true)
    expect(hasLegacyConnectorEvidence([null, "", undefined])).toBe(false)
    expect(hasLegacyConnectorEvidence([])).toBe(false)
  })

  it("con los pagos apagados no limita a nadie", () => {
    expect(canUseConnectors({ paymentsEnabled: false, plan: "free", evidenceCreatedAt: [] })).toBe(true)
  })

  it("un gratis nuevo no tiene acceso y uno con token o uso previo sí lo conserva", () => {
    expect(canUseConnectors({ paymentsEnabled: true, plan: "free", evidenceCreatedAt: [] })).toBe(false)
    expect(canUseConnectors({
      paymentsEnabled: true,
      plan: "free",
      evidenceCreatedAt: [beforeCutoff],
    })).toBe(true)
    expect(canUseConnectors({
      paymentsEnabled: true,
      plan: "free",
      evidenceCreatedAt: [afterCutoff],
    })).toBe(false)
    expect(canUseConnectors({
      paymentsEnabled: true,
      plan: "pro",
      source: "stripe",
      subscriptionStatus: "trialing",
      evidenceCreatedAt: [],
    })).toBe(true)
  })
})
