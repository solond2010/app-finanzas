import { createMcpHandler, withMcpAuth } from "mcp-handler"
import type { AuthInfo } from "@modelcontextprotocol/server"
import { z } from "zod"
import {
  addTransactionTool,
  listAccountsTool,
  listCategoriesTool,
  listRecentTransactionsTool,
  MAX_AMOUNT,
  MAX_NOTE_LENGTH,
  MAX_RECENT,
  toolResultText,
  type McpStore,
} from "@/lib/mcp/tools"

export type McpUserResolver = (token: string) => Promise<{ userId: string } | null>

function jsonResult(result: { isError: boolean; text: string }) {
  return {
    isError: result.isError,
    content: [{ type: "text" as const, text: result.text }],
  }
}

function userIdFrom(ctx: { http?: { authInfo?: AuthInfo } }): string {
  const extra = ctx.http?.authInfo?.extra as { userId?: string } | undefined
  const userId = extra?.userId
  if (!userId) throw new Error("Falta el usuario autenticado")
  return userId
}

export function createGarraMcpHandler(store: McpStore, resolveUser: McpUserResolver) {
  const handler = createMcpHandler(
    (server) => {
      server.registerTool(
        "list_accounts",
        {
          title: "Listar cuentas",
          description: "Lista las cuentas del usuario autenticado (id, nombre, saldo y divisa).",
          inputSchema: z.object({}),
        },
        async (_args, ctx) => jsonResult(toolResultText(await listAccountsTool(store, userIdFrom(ctx)))),
      )

      server.registerTool(
        "list_categories",
        {
          title: "Listar categorías",
          description: "Lista las categorías del usuario autenticado (id, nombre y tipo).",
          inputSchema: z.object({}),
        },
        async (_args, ctx) => jsonResult(toolResultText(await listCategoriesTool(store, userIdFrom(ctx)))),
      )

      server.registerTool(
        "list_recent_transactions",
        {
          title: "Listar movimientos recientes",
          description: "Lista los movimientos más recientes del usuario, del más nuevo al más antiguo.",
          inputSchema: z.object({
            limit: z.number().int().min(1).max(MAX_RECENT).optional().describe("Número de movimientos (1-50, por defecto 10)"),
          }),
        },
        async (args, ctx) => jsonResult(toolResultText(await listRecentTransactionsTool(store, userIdFrom(ctx), args))),
      )

      server.registerTool(
        "add_transaction",
        {
          title: "Apuntar un movimiento",
          description: "Añade un gasto o un ingreso a una cuenta existente, con categoría, fecha e importe. No crea cuentas.",
          inputSchema: z.object({
            tipo: z.enum(["gasto", "ingreso"]).describe("Tipo de movimiento"),
            monto: z.number().positive().max(MAX_AMOUNT).describe("Importe mayor que 0"),
            cuenta: z.string().min(1).describe("Id o nombre de la cuenta"),
            categoria: z.string().min(1).describe("Id o nombre de la categoría"),
            fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha YYYY-MM-DD; por defecto hoy en Europe/Madrid"),
            nota: z.string().max(MAX_NOTE_LENGTH).optional().describe("Nota o descripción opcional"),
          }),
        },
        async (args, ctx) => jsonResult(toolResultText(await addTransactionTool(store, userIdFrom(ctx), args))),
      )
    },
    { serverInfo: { name: "garra", version: "1.0.0" } },
  )

  const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
    if (!bearerToken) return undefined
    const user = await resolveUser(bearerToken)
    if (!user) return undefined
    return {
      token: bearerToken,
      clientId: user.userId,
      scopes: ["garra"],
      extra: { userId: user.userId },
    }
  }

  return withMcpAuth(handler, verifyToken, {
    required: true,
    requiredScopes: ["garra"],
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
  })
}

