import { NextResponse } from "next/server"
import { LIVE_FX_CODES } from "@/lib/currency"

// Tipos de cambio diarios agregados de proveedores oficiales vía Frankfurter.
export async function GET() {
  try {
    const quotes = LIVE_FX_CODES.join(",")
    const res = await fetch(`https://api.frankfurter.dev/v2/rates?base=EUR&quotes=${quotes}`, {
      next: { revalidate: 3600 }, // los tipos de cambio no cambian de un minuto a otro
    })
    if (!res.ok) throw new Error(`Frankfurter respondió ${res.status}`)
    const body = await res.json() as Array<{ quote?: string; rate?: number }>
    const out: Record<string, number> = {}
    for (const row of body) {
      const perEur = row.rate
      if (row.quote && typeof perEur === "number" && perEur > 0) out[row.quote] = 1 / perEur
    }
    if (Object.keys(out).length === 0) throw new Error("Respuesta inesperada")
    // La app guarda "cuántos euros vale 1 unidad de esa divisa" (EUR_RATES),
    // así que se invierte: la API da "cuántas unidades de X vale 1 EUR".
    return NextResponse.json(out)
  } catch {
    return NextResponse.json({ error: "No se pudieron obtener tipos de cambio en vivo" }, { status: 502 })
  }
}
