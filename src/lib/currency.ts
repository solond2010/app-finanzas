export type CurrencyCode = "EUR" | "USD" | "CHF"

export const CURRENCY_OPTIONS: Array<{ code: CurrencyCode; label: string }> = [
  { code: "EUR", label: "Euro (€)" },
  { code: "USD", label: "Dólar ($)" },
  { code: "CHF", label: "Franco suizo (CHF)" },
]

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  EUR: "€",
  USD: "$",
  CHF: "CHF",
}

export const EUR_RATES: Record<CurrencyCode, number> = {
  EUR: 1,
  USD: 0.92,
  CHF: 1.04,
}

export function currencySymbol(currency: CurrencyCode) {
  return CURRENCY_SYMBOLS[currency] ?? "€"
}

export function convertToEur(amount: number, currency: CurrencyCode) {
  return amount * EUR_RATES[currency]
}

export function formatMoney(amount: number, currency: CurrencyCode) {
  return `${amount.toLocaleString("es-ES")} ${currencySymbol(currency)}`
}
