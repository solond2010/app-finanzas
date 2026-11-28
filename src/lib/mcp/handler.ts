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
import { getMonthlySummaryTool } from "@/lib/mcp/monthly-summary-tool"
import { importTransactionsTool, previewImportTransactionsTool } from "@/lib/mcp/import-transactions"

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

      server.registerTool(
        "get_monthly_summary",
        {
          title: "Resumen del mes",
          description: "Resumen de solo lectura: ingresos y gastos del mes, desglose por categoría y comparación con el mes anterior. El mes es YYYY-MM; si no se indica, se usa el mes actual en Europe/Madrid. No escribe nada.",
          inputSchema: z.object({
            month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("Mes YYYY-MM; por defecto el mes actual en Europe/Madrid"),
          }),
        },
        async (args, ctx) => jsonResult(toolResultText(await getMonthlySummaryTool(store, userIdFrom(ctx), args))),
      )

      server.registerTool(
        "preview_import_transactions",
        {
          title: "Vista previa de importación",
          description: "SOLO LECTURA. Vista previa de un lote de hasta 500 movimientos (por ejemplo, leídos de un Excel). Valida, asigna cuentas y categorías ya existentes (no crea ninguna) y detecta posibles duplicados. Devuelve un resumen y un import_token (caduca en 15 min). Llama SIEMPRE primero a esta herramienta, enseña el resumen al usuario y no llames a import_transactions hasta que el usuario confirme explícitamente. Si el Excel tiene más de 500 filas, pártelo tú en lotes de como máximo 500 (preferiblemente por meses, agrupando meses consecutivos si un mes es pequeño), avisa al usuario de cuántos lotes van a ser y pide confirmación en cada lote. Hay un máximo de 10 lotes importados cada 24 horas.",
          inputSchema: z.object({
            rows: z.array(z.object({
              date: z.string().optional().describe("Fecha YYYY-MM-DD o DD/MM/YYYY"),
              amount: z.union([z.number(), z.string()]).describe("Importe; negativo se trata como gasto"),
              description: z.string().optional().describe("Descripción o concepto"),
              account: z.string().min(1).describe("Id o nombre de una cuenta ya existente"),
              category: z.string().optional().describe("Id o nombre de una categoría ya existente"),
              type: z.string().optional().describe("gasto o ingreso, si no se puede inferir"),
            })).min(1).describe("Filas a previsualizar. Máximo 500 por lote. Si hay más, pártelas tú en lotes de como máximo 500 (preferiblemente por meses), llama a esta herramienta por lote, enseña cada vista previa y espera confirmación explícita antes de import_transactions. Avisa al usuario de cuántos lotes van a ser."),
          }),
        },
        async (args, ctx) => jsonResult(toolResultText(await previewImportTransactionsTool(store, userIdFrom(ctx), args))),
      )

      server.registerTool(
        "import_transactions",
        {
          title: "Importar movimientos",
          description: "INSERTA los movimientos de un import_token generado por preview_import_transactions. Exige confirm=true. Solo inserta, nunca edita ni borra; salta duplicados y es idempotente. Llama SIEMPRE antes a preview_import_transactions, enseña la vista previa al usuario y usa esta herramienta solo tras su confirmación explícita. Si hay más de 500 filas, pártelas tú en lotes de como máximo 500 (preferiblemente por meses), con una vista previa y una confirmación por lote, y avisa al usuario de cuántos lotes van a ser.",
          inputSchema: z.object({
            import_token: z.string().min(1).describe("Token devuelto por preview_import_transactions"),
            confirm: z.boolean().describe("Debe ser true solo si el usuario ha confirmado explícitamente la importación"),
          }),
        },
        async (args, ctx) => jsonResult(toolResultText(await importTransactionsTool(store, userIdFrom(ctx), args))),
      )
    },
    {
      serverInfo: { name: "Garra", version: "1.0.0" },
      instructions: "Garra es una app de finanzas personales. Usa get_monthly_summary para el resumen de un mes (por defecto el mes actual en Europe/Madrid). Si el usuario quiere importar un Excel, llama SIEMPRE primero a preview_import_transactions, enseña el resumen y solo entonces, con confirmación explícita, import_transactions con confirm=true. Si hay más de 500 filas, pártelas tú en lotes de como máximo 500 (preferiblemente por meses, agrupando meses consecutivos si hace falta), avisa de cuántos lotes van a ser y pide confirmación en cada uno. Hay un máximo de 10 lotes importados cada 24 horas. En ChatGPT, en cada chat nuevo actívalo con @Garra y un modelo que no sea Ligero.",
    },
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

