import { NNBSP } from "./format"

/** Divisas disponibles en cuentas y selectores. Un solo origen compartido. */
export const CURRENCY_CODES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "JPY",
  "CNY",
  "CAD",
  "AUD",
  "NZD",
  "MXN",
  "BRL",
  "INR",
  "AED",
  "SAR",
  "SGD",
  "HKD",
  "KRW",
  "TWD",
  "ILS",
  "SEK",
  "NOK",
  "DKK",
  "ISK",
  "PLN",
  "CZK",
  "HUF",
  "ZAR",
  "TRY",
  "THB",
  "RUB",
  "PHP",
  "IDR",
] as const

export type CurrencyCode = (typeof CURRENCY_CODES)[number]

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value)
}

/** Códigos con cotización en vivo vía Frankfurter. */
export const LIVE_FX_CODES = CURRENCY_CODES.filter((c) => c !== "EUR")

/** Etiquetas en español para el selector (EUR/USD/CHF primero; resto por código). */
export const CURRENCY_OPTIONS: Array<{ code: CurrencyCode; label: string }> = [
  { code: "EUR", label: "Euro (€)" },
  { code: "USD", label: "Dólar estadounidense (USD)" },
  { code: "GBP", label: "Libra esterlina (GBP)" },
  { code: "CHF", label: "Franco suizo (CHF)" },
  { code: "JPY", label: "Yen japonés (JPY)" },
  { code: "CNY", label: "Yuan chino (CNY)" },
  { code: "CAD", label: "Dólar canadiense (CAD)" },
  { code: "AUD", label: "Dólar australiano (AUD)" },
  { code: "NZD", label: "Dólar neozelandés (NZD)" },
  { code: "MXN", label: "Peso mexicano (MXN)" },
  { code: "BRL", label: "Real brasileño (BRL)" },
  { code: "INR", label: "Rupia india (INR)" },
  { code: "AED", label: "Dírham de Emiratos Árabes Unidos (AED)" },
  { code: "SAR", label: "Riyal saudí (SAR)" },
  { code: "SGD", label: "Dólar de Singapur (SGD)" },
  { code: "HKD", label: "Dólar de Hong Kong (HKD)" },
  { code: "KRW", label: "Won surcoreano (KRW)" },
  { code: "TWD", label: "Dólar taiwanés (TWD)" },
  { code: "ILS", label: "Nuevo séquel israelí (ILS)" },
  { code: "SEK", label: "Corona sueca (SEK)" },
  { code: "NOK", label: "Corona noruega (NOK)" },
  { code: "DKK", label: "Corona danesa (DKK)" },
  { code: "ISK", label: "Corona islandesa (ISK)" },
  { code: "PLN", label: "Złoty polaco (PLN)" },
  { code: "CZK", label: "Corona checa (CZK)" },
  { code: "HUF", label: "Florín húngaro (HUF)" },
  { code: "ZAR", label: "Rand sudafricano (ZAR)" },
  { code: "TRY", label: "Lira turca (TRY)" },
  { code: "THB", label: "Baht tailandés (THB)" },
  { code: "RUB", label: "Rublo ruso (RUB)" },
  { code: "PHP", label: "Peso filipino (PHP)" },
  { code: "IDR", label: "Rupia indonesia (IDR)" },
]

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  EUR: "€",
  USD: "US$",
  GBP: "£",
  CHF: "CHF",
  JPY: "¥",
  CNY: "CN¥",
  CAD: "CA$",
  AUD: "A$",
  NZD: "NZ$",
  MXN: "MX$",
  BRL: "R$",
  INR: "₹",
  AED: "AED",
  SAR: "SAR",
  SGD: "S$",
  HKD: "HK$",
  KRW: "₩",
  TWD: "NT$",
  ILS: "₪",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  ISK: "kr",
  PLN: "zł",
  CZK: "Kč",
  HUF: "Ft",
  ZAR: "R",
  TRY: "₺",
  THB: "฿",
  RUB: "₽",
  PHP: "₱",
  IDR: "Rp",
}

// Valores de respaldo: se usan hasta que refreshExchangeRates() trae los
// tipos reales (o si esa petición falla, p. ej. sin red). No se mantienen a
// mano; approximan un punto de partida razonable, no la cotización actual.
// Unidades: euros por 1 unidad de la divisa.
export const FALLBACK_EUR_RATES: Record<CurrencyCode, number> = {
  EUR: 1,
  USD: 0.92,
  CHF: 1.04,
  GBP: 1.17,
  JPY: 0.0061,
  CNY: 0.13,
  CAD: 0.67,
  AUD: 0.60,
  NZD: 0.55,
  MXN: 0.050,
  BRL: 0.16,
  INR: 0.011,
  AED: 0.25,
  SAR: 0.25,
  SGD: 0.70,
  HKD: 0.118,
  KRW: 0.00066,
  TWD: 0.029,
  ILS: 0.25,
  SEK: 0.087,
  NOK: 0.084,
  DKK: 0.134,
  ISK: 0.0067,
  PLN: 0.23,
  CZK: 0.040,
  HUF: 0.0025,
  ZAR: 0.050,
  TRY: 0.023,
  THB: 0.026,
  RUB: 0.010,
  PHP: 0.016,
  IDR: 0.000058,
}

const EUR_RATES: Record<CurrencyCode, number> = { ...FALLBACK_EUR_RATES }

/**
 * Sustituye EUR_RATES por tipos de cambio actuales (vía /api/fx).
 * Se llama una vez al arrancar la app (antes de que se muestre ninguna
 * cifra convertida), así que convertToEur no necesita ningún cambio: sigue
 * siendo síncrona y lee siempre el valor más reciente de este mismo objeto.
 */
export async function refreshExchangeRates(): Promise<void> {
  try {
    const res = await fetch("/api/fx")
    if (!res.ok) return
    const rates = (await res.json()) as Record<string, unknown>
    for (const code of LIVE_FX_CODES) {
      const rate = rates[code]
      if (typeof rate === "number" && rate > 0) EUR_RATES[code] = rate
    }
  } catch {
    // sin red → seguimos con los valores de respaldo
  }
}

export function currencySymbol(currency: CurrencyCode) {
  return CURRENCY_SYMBOLS[currency] ?? currency
}

export function hasExchangeRate(currency: CurrencyCode) {
  const rate = EUR_RATES[currency]
  return typeof rate === "number" && rate > 0
}

export function eurPerUnit(currency: CurrencyCode) {
  const rate = EUR_RATES[currency]
  return typeof rate === "number" && rate > 0 ? rate : 1
}

export function convertToEur(amount: number, currency: CurrencyCode) {
  return amount * eurPerUnit(currency)
}

export function convertFromEur(amount: number, currency: CurrencyCode) {
  const rate = eurPerUnit(currency)
  return rate > 0 ? amount / rate : amount
}

export function formatMoney(amount: number, currency: CurrencyCode) {
  // Espacio fino inseparable, como en money() (lib/format.ts): misma
  // tipografía de importes en toda la app.
  return `${amount.toLocaleString("es-ES", { useGrouping: "always", minimumFractionDigits: 2, maximumFractionDigits: 2 })}${NNBSP}${currencySymbol(currency)}`
}
