import { NextResponse } from "next/server"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
}

export function oauthOptions() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export function oauthJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS })
}

export async function readTokenRequest(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? ""
  if (type.includes("application/json")) {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) return {}
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value
    }
    return out
  }
  const text = await request.text()
  const params = new URLSearchParams(text)
  const out: Record<string, string> = {}
  for (const [key, value] of params.entries()) out[key] = value
  return out
}

export function clientFromBasicAuth(request: Request): { client_id?: string; client_secret?: string } {
  const header = request.headers.get("authorization")
  if (!header) return {}
  const match = /^Basic\s+(\S+)/i.exec(header.trim())
  if (!match) return {}
  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8")
    const cut = decoded.indexOf(":")
    if (cut < 0) return { client_id: decoded }
    return { client_id: decoded.slice(0, cut), client_secret: decoded.slice(cut + 1) }
  } catch {
    return {}
  }
}

export function withClientCredentials(request: Request, body: Record<string, string>): Record<string, string> {
  const basic = clientFromBasicAuth(request)
  return {
    ...body,
    client_id: body.client_id || basic.client_id || "",
    client_secret: body.client_secret || basic.client_secret || "",
  }
}
