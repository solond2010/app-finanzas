import { NextResponse } from "next/server"

// Tipos de cambio en vivo (base EUR) desde Frankfurter (frankfurter.dev),
// que sirve tipos oficiales del BCE, es gratis y no requiere clave. Antes
// estaban fijos a mano en currency.ts y nunca se actualizaban.
export async function GET() {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,CHF", {
      next: { revalidate: 3600 }, // los tipos de cambio no cambian de un minuto a otro
    })
    if (!res.ok) throw new Error(`Frankfurter respondió ${res.status}`)
    const body = await res.json()
    const usdPerEur = body.rates?.USD
    const chfPerEur = body.rates?.CHF
    if (typeof usdPerEur !== "number" || typeof chfPerEur !== "number") throw new Error("Respuesta inesperada")
    // La app guarda "cuántos euros vale 1 unidad de esa divisa" (EUR_RATES),
    // así que se invierte: la API da "cuántos USD/CHF vale 1 EUR".
    return NextResponse.json({ USD: 1 / usdPerEur, CHF: 1 / chfPerEur })
  } catch {
    return NextResponse.json({ error: "No se pudieron obtener tipos de cambio en vivo" }, { status: 502 })
  }
}
