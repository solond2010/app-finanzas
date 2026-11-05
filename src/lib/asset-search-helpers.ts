/** Filtro y orden de resultados del buscador de activos (Yahoo). */

export type SearchHit = { symbol: string; name: string; type: string; exchange?: string }

const EUR_EXCHANGES = new Set([
  "GER", "FRA", "PAR", "AMS", "BRU", "LIS", "MIL", "MCE", "MAD", "VIE", "HEL",
  "DUS", "STU", "HAM", "MUN", "EUX", "PRA", "WSE", "ATH", "BUD", "TASE",
])
const USD_EXCHANGES = new Set(["NYQ", "NMS", "NGM", "ASE", "PCX", "BTS", "NCM", "OQB", "NYSE", "NASDAQ"])
const EUR_SUFFIX = /\.(DE|PA|AS|BR|LS|MI|MC|VI|HE|IR|BD|BE|TI)$/i

/** Crypto o acciones tokenizadas que no deben salir en Acciones/ETF. */
export function isCryptoOrTokenized(r: SearchHit): boolean {
  if (r.type === "CRYPTOCURRENCY") return true
  const n = `${r.name} ${r.symbol}`.toLowerCase()
  return /tokeni[sz]ed|\bxstock\b|wrapped .+stock|\(ondo\)|ond[oa]\b|derivatives|tokenized stock/.test(n)
}

/** Divisa probable según sufijo Yahoo / mercado (best-effort). */
export function guessCurrency(r: SearchHit): string {
  const sym = r.symbol
  const ex = (r.exchange ?? "").toUpperCase()
  if (/-USD$/i.test(sym) || /\.US$/i.test(sym)) return "USD"
  if (EUR_SUFFIX.test(sym) || EUR_EXCHANGES.has(ex)) return "EUR"
  if (/\.L$/i.test(sym) || ex === "LSE") return "GBP"
  if (/\.(SW|VX)$/i.test(sym) || ex === "EBS") return "CHF"
  if (USD_EXCHANGES.has(ex) || !/[.]/.test(sym)) return "USD"
  return "—"
}

/**
 * Filtra por tipos de la pestaña, oculta crypto/tokenizados en Acciones/ETF,
 * prioriza cotizaciones EUR y limita el tamaño.
 */
export function filterSearchResults(
  results: SearchHit[],
  activeTypes: string[],
  opts: { hideCrypto?: boolean; limit?: number } = {},
): (SearchHit & { currency: string })[] {
  const hideCrypto = opts.hideCrypto ?? activeTypes.includes("EQUITY")
  const limit = opts.limit ?? 8
  let list = results.filter((r) => activeTypes.includes(r.type))
  if (hideCrypto) list = list.filter((r) => !isCryptoOrTokenized(r))
  const withCur = list.map((r) => ({ ...r, currency: guessCurrency(r) }))
  withCur.sort((a, b) => {
    const ae = a.currency === "EUR" ? 0 : 1
    const be = b.currency === "EUR" ? 0 : 1
    if (ae !== be) return ae - be
    return a.name.localeCompare(b.name, "es")
  })
  return withCur.slice(0, limit)
}

/** Precio por unidad en divisa del activo a partir de un importe pagado en EUR. */
export function buyPriceFromEurPaid(eurPaid: number, units: number, eurPerForeign: number): number | null {
  if (!(eurPaid > 0) || !(units > 0) || !(eurPerForeign > 0)) return null
  const foreignTotal = eurPaid / eurPerForeign
  return Math.round((foreignTotal / units) * 1e6) / 1e6
}
