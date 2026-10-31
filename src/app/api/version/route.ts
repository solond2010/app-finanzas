import { NextResponse } from "next/server"

// Versión del despliegue en curso (pública: es solo el id del commit). La usa
// VersionWatcher para saber si la app abierta se ha quedado vieja.
export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_BUILD_ID || "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  )
}
