/** URL pública del MCP. Se muestra en Ajustes; no depende del origen local. */
export const MCP_ENDPOINT_URL = "https://www.migarra.app/api/mcp"

export const MCP_TOKEN_DEFAULT_NAME = "MCP"
export const MAX_ACTIVE_MCP_TOKENS = 5

/** Pasos de ChatGPT y Claude.ai visibles en Ajustes tras la prueba real. */
export const MCP_OAUTH_CONNECTORS_PUBLIC = true

export const MCP_OAUTH_CONNECTOR_STEPS = [
  {
    title: "ChatGPT",
    text: "En la web de ChatGPT (no en el móvil), elige un modelo que no sea Ligero. Ve a Complementos (chatgpt.com/plugins), pulsa + y añade un servidor MCP personalizado llamado «Garra» con la URL https://www.migarra.app/api/mcp. Inicia sesión en Garra con OAuth y autoriza. En cada chat nuevo, escribe @Garra para activarlo y entonces pregunta.",
  },
  {
    title: "Claude.ai",
    text: "En Claude.ai, ve a Ajustes › Conectores, añade un conector personalizado con la misma URL y pulsa Conectar. Inicia sesión en Garra y autoriza el acceso.",
  },
] as const

export type McpTokenItem = {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
}

export type McpGrantItem = {
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
