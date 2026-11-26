import { NextResponse } from "next/server"
import { CONNECTORS_PRO_ERROR, CONNECTORS_PRO_HREF } from "@/lib/billing/connectors-access"
import { inspectMcpRequestAccess, resolveMcpRequestUser } from "@/lib/mcp/auth"
import { createGarraMcpHandler } from "@/lib/mcp/handler"
import { supabaseMcpStore } from "@/lib/mcp/supabase-store"

const MCP_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: MCP_CORS })
}

// Endpoint MCP remoto (Streamable HTTP). Acepta un token personal o un
// access token OAuth en Authorization: Bearer.
const inner = createGarraMcpHandler(supabaseMcpStore, async (token) => resolveMcpRequestUser(token))

async function handler(request: Request) {
  const auth = request.headers.get("authorization")
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
  if (token && (await inspectMcpRequestAccess(token)) === "forbidden") {
    return Response.json(
      { error: CONNECTORS_PRO_ERROR, href: CONNECTORS_PRO_HREF },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    )
  }
  return inner(request)
}

export { handler as GET, handler as POST }
