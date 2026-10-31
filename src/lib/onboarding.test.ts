import { describe, expect, it } from "vitest"
import { hasOwnAccount, parseOnboardingStatus, shouldShowOnboarding } from "./onboarding"

describe("guía de bienvenida", () => {
  it("no se muestra al administrador", () => {
    expect(shouldShowOnboarding({ isAdmin: true, status: null, transactionCount: 0 })).toBe(false)
  })
  it("se muestra a una cuenta vacía sin estado", () => {
    expect(shouldShowOnboarding({ isAdmin: false, status: null, transactionCount: 0 })).toBe(true)
  })
  it("no aparece de golpe a quien ya usa la app", () => {
    expect(shouldShowOnboarding({ isAdmin: false, status: null, transactionCount: 12 })).toBe(false)
  })
  it("sigue visible si ya estaba empezada, aunque haya movimientos", () => {
    expect(shouldShowOnboarding({ isAdmin: false, status: "started", transactionCount: 3 })).toBe(true)
  })
  it("recuerda que se cerró o se terminó", () => {
    expect(shouldShowOnboarding({ isAdmin: false, status: "dismissed", transactionCount: 0 })).toBe(false)
    expect(shouldShowOnboarding({ isAdmin: false, status: "done", transactionCount: 0 })).toBe(false)
  })
  it("las cuentas por defecto vacías no cuentan como cuenta propia", () => {
    expect(hasOwnAccount([{ id: "acc_principal", banco: "", saldo: 0 }])).toBe(false)
    expect(hasOwnAccount([{ id: "acc_principal", banco: "BBVA", saldo: 0 }])).toBe(true)
    expect(hasOwnAccount([{ id: "acc_gastos", banco: "", saldo: 120 }])).toBe(true)
    expect(hasOwnAccount([{ id: "mi-cuenta", banco: "", saldo: 0 }])).toBe(true)
  })
  it("ignora estados desconocidos", () => {
    expect(parseOnboardingStatus("otra cosa")).toBe(null)
    expect(parseOnboardingStatus("dismissed")).toBe("dismissed")
  })
})
