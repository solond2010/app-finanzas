import { createHash, randomBytes, timingSafeEqual } from "crypto"

export const MCP_TOKEN_PREFIX = "grr_"

/** Token en claro que se muestra una sola vez al generarlo. Nunca se guarda así. */
export function generateMcpToken(): string {
  return `${MCP_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`
}

export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function isMcpTokenFormat(token: string): boolean {
  return token.startsWith(MCP_TOKEN_PREFIX) && token.length >= MCP_TOKEN_PREFIX.length + 32
}

export function bearerFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization")
  if (!header) return null
  const match = /^Bearer\s+(\S+)/i.exec(header.trim())
  return match?.[1] ?? null
}

export function hashesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
