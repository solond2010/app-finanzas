import { describe, expect, it } from "vitest"
import { parseRecoveryHash } from "./auth-reset-hash"

describe("parseRecoveryHash", () => {
  it("lee access_token y refresh_token del hash implicit", () => {
    const parsed = parseRecoveryHash("#access_token=aaa&refresh_token=bbb&type=recovery&expires_in=3600")
    expect(parsed).toEqual({ accessToken: "aaa", refreshToken: "bbb", type: "recovery" })
  })
  it("devuelve error si Supabase rechazó el enlace", () => {
    expect(parseRecoveryHash("#error=access_denied&error_code=otp_expired")).toEqual({ error: "otp_expired" })
  })
  it("ignora un hash vacío o sin tokens", () => {
    expect(parseRecoveryHash("")).toBeNull()
    expect(parseRecoveryHash("#foo=bar")).toBeNull()
  })
})
