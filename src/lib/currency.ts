import { NNBSP } from "./format"

export type CurrencyCode = "EUR" | "USD" | "CHF"

export const CURRENCY_OPTIONS: Array<{ code: CurrencyCode; label: string }> = [
  { code: "EUR", label: "Euro (€)" },
  { code: "USD", label: "Dólar ($)" },
  { code: "CHF", label: "Franco suizo (CHF)" },
]

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  EUR: "€",
  USD: "$",
  CHF: "CHF",
}

// Valores de respaldo: se usan hasta que refreshExchangeRates() trae los
// tipos reales (o si esa petición falla, p. ej. sin red). No se mantienen a
// mano; approximan un punto de partida razonable, no la cotización actual.
const EUR_RATES: Record<CurrencyCode, number> = {
  EUR: 1,
  USD: 0.92,
  CHF: 1.04,
}

/**
 * Sustituye EUR_RATES por tipos de cambio reales (vía /api/fx, tipos BCE).
 * Se llama una vez al arrancar la app (antes de que se muestre ninguna
 * cifra convertida), así que convertToEur no necesita ningún cambio: sigue
 * siendo síncrona y lee siempre el valor más reciente de este mismo objeto.
 */
export async function refreshExchangeRates(): Promise<void> {
  try {
    const res = await fetch("/api/fx")
    if (!res.ok) return
    const rates = await res.json()
    if (typeof rates.USD === "number") EUR_RATES.USD = rates.USD
    if (typeof rates.CHF === "number") EUR_RATES.CHF = rates.CHF
  } catch {
    // sin red → seguimos con los valores de respaldo
  }
}

export function currencySymbol(currency: CurrencyCode) {
  return CURRENCY_SYMBOLS[currency] ?? "€"
}

export function convertToEur(amount: number, currency: CurrencyCode) {
  return amount * EUR_RATES[currency]
}

export function formatMoney(amount: number, currency: CurrencyCode) {
  // Espacio fino inseparable, como en money() (lib/format.ts): misma
  // tipografía de importes en toda la app.
  return `${amount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${NNBSP}${currencySymbol(currency)}`
}
