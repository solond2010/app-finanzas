import { createGarraMcpHandler } from "@/lib/mcp/handler"
import { resolveMcpRequestUser } from "@/lib/mcp/auth"
import { supabaseMcpStore } from "@/lib/mcp/supabase-store"

// Endpoint MCP remoto (Streamable HTTP). Acepta un token personal o un
// access token OAuth en Authorization: Bearer.
const handler = createGarraMcpHandler(supabaseMcpStore, async (token) => resolveMcpRequestUser(token))

export { handler as GET, handler as POST }
