import { createHash, timingSafeEqual } from "crypto"

const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/
const CHALLENGE_RE = /^[A-Za-z0-9_-]{43,128}$/

export function isValidCodeVerifier(value: string): boolean {
  return VERIFIER_RE.test(value)
}

export function isValidCodeChallenge(value: string): boolean {
  return CHALLENGE_RE.test(value)
}

export function s256Challenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url")
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!isValidCodeVerifier(verifier) || !isValidCodeChallenge(challenge)) return false
  const computed = Buffer.from(s256Challenge(verifier))
  const expected = Buffer.from(challenge)
  if (computed.length !== expected.length) return false
  return timingSafeEqual(computed, expected)
}
