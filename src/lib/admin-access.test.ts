import { describe, expect, it } from "vitest"
import { isAdminUserId, LEGACY_USER_ID } from "./auth-mode"

describe("isAdminUserId", () => {
  it("niega el acceso si no hay usuario o no está en la lista", () => {
    expect(isAdminUserId(null)).toBe(false)
    expect(isAdminUserId(undefined)).toBe(false)
    expect(isAdminUserId("")).toBe(false)
    expect(isAdminUserId("00000000-0000-0000-0000-000000000000")).toBe(false)
  })

  it("reconoce al admin habitual y a ids extra configurados", () => {
    expect(isAdminUserId(LEGACY_USER_ID)).toBe(true)
    expect(isAdminUserId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")).toBe(true)
    expect(isAdminUserId("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")).toBe(false)
  })
})
