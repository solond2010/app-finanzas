import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { ACCESS_TOKEN_PREFIX, AUTH_CODE_PREFIX, CLIENT_ID_PREFIX, REFRESH_TOKEN_PREFIX } from "@/lib/oauth/constants"

export function randomSecret(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`
}

export function newClientId(): string {
  return randomSecret(CLIENT_ID_PREFIX, 18)
}

export function newClientSecret(): string {
  return randomSecret("gcs_", 32)
}

export function newAuthorizationCode(): string {
  return randomSecret(AUTH_CODE_PREFIX)
}

export function newAccessToken(): string {
  return randomSecret(ACCESS_TOKEN_PREFIX)
}

export function newRefreshToken(): string {
  return randomSecret(REFRESH_TOKEN_PREFIX)
}

export function hashOauthSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

export function hashesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function isOAuthAccessTokenFormat(token: string): boolean {
  return token.startsWith(ACCESS_TOKEN_PREFIX) && token.length >= ACCESS_TOKEN_PREFIX.length + 32
}

export function isOAuthRefreshTokenFormat(token: string): boolean {
  return token.startsWith(REFRESH_TOKEN_PREFIX) && token.length >= REFRESH_TOKEN_PREFIX.length + 32
}

export function isAuthorizationCodeFormat(code: string): boolean {
  return code.startsWith(AUTH_CODE_PREFIX) && code.length >= AUTH_CODE_PREFIX.length + 32
}
