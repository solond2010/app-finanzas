import { createGarraMcpHandler } from "@/lib/mcp/handler"
import { resolveMcpUser } from "@/lib/mcp/auth"
import { supabaseMcpStore } from "@/lib/mcp/supabase-store"

// Endpoint MCP remoto (Streamable HTTP). Se autentica con un token
// personal por usuario (Authorization: Bearer), no con la cookie de sesión.
// La migración de mcp_tokens no se aplica en la fase 1.
const handler = createGarraMcpHandler(supabaseMcpStore, async (token) => resolveMcpUser(token))

export { handler as GET, handler as POST }
