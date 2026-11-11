import { describe, expect, it } from "vitest"
import { confirmCopy, defaultNextForOtp, loginNotice, parseOtpType } from "./auth-links"

const params = (q: string) => new URLSearchParams(q)

describe("enlaces de email", () => {
  it("solo acepta tipos de enlace conocidos", () => {
    expect(parseOtpType("email")).toBe("email")
    expect(parseOtpType("recovery")).toBe("recovery")
    expect(parseOtpType("admin")).toBeNull()
    expect(parseOtpType(null)).toBeNull()
  })
  it("avisos de /login", () => {
    expect(loginNotice(params("aviso=confirmado"))?.kind).toBe("info")
    expect(loginNotice(params("aviso=confirmado"))?.text).toContain("ya está confirmado")
    expect(loginNotice(params("aviso=enlace-usado"))?.kind).toBe("info")
    expect(loginNotice(params("error=enlace"))?.kind).toBe("error")
    expect(loginNotice(params("aviso=google-cancelado"))?.kind).toBe("info")
    expect(loginNotice(params("aviso=google-cancelado"))?.text).toContain("cancelado")
    expect(loginNotice(params("aviso=google-error"))?.kind).toBe("error")
    expect(loginNotice(params(""))).toBeNull()
  })
  it("botón según el tipo", () => {
    expect(confirmCopy("signup").button).toBe("Confirmar mi email")
    expect(confirmCopy("recovery").title).toContain("contraseña")
    expect(confirmCopy("recovery").button).toBe("Continuar")
    expect(defaultNextForOtp("recovery")).toBe("/auth/reset")
    expect(defaultNextForOtp("email")).toBe("/dashboard")
  })
})
