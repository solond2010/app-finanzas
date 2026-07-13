import { NextResponse } from "next/server"

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

interface ChartMeta {
  regularMarketPrice?: number
  currency?: string
  shortName?: string
  longName?: string
  regularMarketTime?: number
  previousClose?: number
  chartPreviousClose?: number
}

interface Quote {
  price: number
  currency: string
  name: string
  time: number | null
  changePct: number | null
}

async function fetchQuote(symbol: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: { "User-Agent": UA }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = (await res.json()) as { chart?: { result?: { meta?: ChartMeta }[] } }
    const meta = data.chart?.result?.[0]?.meta
    if (!meta || typeof meta.regularMarketPrice !== "number") return null
    const prev = typeof meta.previousClose === "number" ? meta.previousClose : meta.chartPreviousClose
    const changePct = typeof prev === "number" && prev !== 0 ? (meta.regularMarketPrice / prev - 1) * 100 : null
    return {
      price: meta.regularMarketPrice,
      currency: meta.currency ?? "EUR",
      name: meta.longName || meta.shortName || symbol,
      time: meta.regularMarketTime ?? null,
      changePct,
    }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40)

  const entries = await Promise.all(symbols.map(async (s) => [s, await fetchQuote(s)] as const))
  const quotes: Record<string, Quote> = {}
  for (const [s, q] of entries) {
    if (q) quotes[s] = q
  }
  return NextResponse.json({ quotes })
}
