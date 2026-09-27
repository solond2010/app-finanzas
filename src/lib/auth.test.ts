import { describe, it, expect } from "vitest"
import { createSessionToken, isValidSessionToken, timingSafeEqualString } from "./auth"

describe("timingSafeEqualString", () => {
  it("es true cuando ambas cadenas son idénticas", () => {
    expect(timingSafeEqualString("secreto123", "secreto123")).toBe(true)
  })
  it("es false ante cualquier diferencia de un carácter", () => {
    expect(timingSafeEqualString("secreto123", "secreto124")).toBe(false)
  })
  it("es false ante longitudes distintas", () => {
    expect(timingSafeEqualString("corto", "muchomaslarga")).toBe(false)
  })
  it("es false comparado con cadena vacía (salvo ambas vacías)", () => {
    expect(timingSafeEqualString("algo", "")).toBe(false)
    expect(timingSafeEqualString("", "")).toBe(true)
  })
})

describe("createSessionToken / isValidSessionToken", () => {
  it("genera un token hex estable (no es la contraseña en claro)", async () => {
    const token = await createSessionToken("mi-password-de-prueba")
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(token).not.toBe("mi-password-de-prueba")
    expect(await createSessionToken("mi-password-de-prueba")).toBe(token)
  })

  it("valida el token correcto y rechaza basura / otro secreto", async () => {
    const secret = "secreto-A"
    const token = await createSessionToken(secret)
    expect(await isValidSessionToken(token, secret)).toBe(true)
    expect(await isValidSessionToken(undefined, secret)).toBe(false)
    expect(await isValidSessionToken("", secret)).toBe(false)
    expect(await isValidSessionToken(secret, secret)).toBe(false)
    expect(await isValidSessionToken(token, "secreto-B")).toBe(false)
  })
})
