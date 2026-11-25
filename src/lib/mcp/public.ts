/** URL pública del MCP. Se muestra en Ajustes; no depende del origen local. */
export const MCP_ENDPOINT_URL = "https://www.migarra.app/api/mcp"

export const MCP_TOKEN_DEFAULT_NAME = "MCP"
export const MAX_ACTIVE_MCP_TOKENS = 5

export type McpTokenItem = {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
}

export function formatMcpTokenDate(value: string | null): string {
  if (!value) return "nunca"
  return new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  })
}
