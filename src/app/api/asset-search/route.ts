import { NextResponse } from "next/server"

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

interface YahooQuote {
  symbol?: string
  shortname?: string
  longname?: string
  quoteType?: string
  exchange?: string
}

type Hit = { symbol: string; name: string; type: string; exchange: string }

/** Consultas extra: Yahoo USA no devuelve Xetra (p. ej. Google → ABEA.DE). */
const EXTRA_QUERIES: { match: RegExp; queries: string[] }[] = [
  { match: /^(google|alphabet|googl|goog)\b/i, queries: ["Alphabet", "ABEA.DE", "ABEC.DE"] },
  { match: /^(apple|aapl)\b/i, queries: ["Apple", "APC.DE"] },
  { match: /^(microsoft|msft)\b/i, queries: ["Microsoft", "MSF.DE"] },
  { match: /^(amazon|amzn)\b/i, queries: ["Amazon", "AMZ.DE"] },
  { match: /^(meta|facebook|fb)\b/i, queries: ["Meta Platforms", "FB2A.DE"] },
  { match: /^(tesla|tsla)\b/i, queries: ["Tesla", "TL0.DE"] },
  { match: /^(nvidia|nvda)\b/i, queries: ["Nvidia", "NVD.DE"] },
]

async function yahooSearch(q: string, region: string, lang: string): Promise<Hit[]> {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=16&newsCount=0&lang=${lang}&region=${region}`
  const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 3600 } })
  if (!res.ok) return []
  const data = (await res.json()) as { quotes?: YahooQuote[] }
  return (data.quotes ?? [])
    .filter((x) => x.symbol && x.quoteType)
    .map((x) => ({
      symbol: x.symbol as string,
      name: x.longname || x.shortname || (x.symbol as string),
      type: x.quoteType as string,
      exchange: x.exchange ?? "",
    }))
}

function mergeHits(lists: Hit[][]): Hit[] {
  const seen = new Set<string>()
  const out: Hit[] = []
  for (const list of lists) {
    for (const h of list) {
      const key = h.symbol.toUpperCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(h)
    }
  }
  return out
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  try {
    const extras = EXTRA_QUERIES.filter((e) => e.match.test(q)).flatMap((e) => e.queries)
    const queries = [q, ...extras.filter((x) => x.toLowerCase() !== q.toLowerCase())]
    // USA + Alemania: en DE aparecen cotizaciones EUR (ABEA.DE, APC.DE…) que Yahoo USA omite.
    const jobs = queries.flatMap((query) => [
      yahooSearch(query, "US", "en-US"),
      yahooSearch(query, "DE", "de-DE"),
    ])
    const lists = await Promise.all(jobs)
    return NextResponse.json({ results: mergeHits(lists) })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
