import { getDataContext, unauthorizedResponse } from "@/lib/server/request-context"
import { json, readJson } from "@/lib/server/auth-helpers"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { countActiveMcpTokens, issueMcpToken, listActiveMcpTokens, revokeMcpToken } from "@/lib/mcp/auth"
import { MAX_ACTIVE_MCP_TOKENS, MCP_TOKEN_DEFAULT_NAME } from "@/lib/mcp/public"

// Gestión de tokens MCP del usuario conectado. Exige sesión (no el Bearer
// del propio MCP). El hash nunca se devuelve; el token en claro solo en POST.

async function requireAccount() {
  if (!isSupabaseAuthEnabled()) return null
  return getDataContext()
}

export async function GET() {
  const ctx = await requireAccount()
  if (!ctx) return unauthorizedResponse()
  try {
    const tokens = await listActiveMcpTokens(ctx.userId)
    return json({ tokens })
  } catch {
    return json({ error: "No se pudieron cargar los tokens" }, 500)
  }
}

export async function POST(request: Request) {
  const ctx = await requireAccount()
  if (!ctx) return unauthorizedResponse()
  const body = await readJson(request)
  const name = typeof body?.name === "string" && body.name.trim()
    ? body.name.trim().slice(0, 60)
    : MCP_TOKEN_DEFAULT_NAME

  try {
    const active = await countActiveMcpTokens(ctx.userId)
    if (active >= MAX_ACTIVE_MCP_TOKENS) {
      return json({ error: `Máximo ${MAX_ACTIVE_MCP_TOKENS} tokens activos. Revoca alguno antes.` }, 400)
    }
    const { token, item } = await issueMcpToken(ctx.userId, name)
    return json({ token, item })
  } catch {
    return json({ error: "No se pudo crear el token" }, 500)
  }
}

export async function DELETE(request: Request) {
  const ctx = await requireAccount()
  if (!ctx) return unauthorizedResponse()
  const body = await readJson(request)
  const id = typeof body?.id === "string" ? body.id : ""
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Token no válido" }, 400)
  try {
    const revoked = await revokeMcpToken(ctx.userId, id)
    if (!revoked) return json({ error: "No se pudo revocar el token" }, 400)
    return json({ ok: true })
  } catch {
    return json({ error: "No se pudo revocar el token" }, 500)
  }
}
