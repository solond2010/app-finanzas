import { NextResponse } from "next/server"

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

interface YahooQuote {
  symbol?: string
  shortname?: string
  longname?: string
  quoteType?: string
  exchange?: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0`,
      { headers: { "User-Agent": UA }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return NextResponse.json({ results: [] })
    const data = (await res.json()) as { quotes?: YahooQuote[] }
    const results = (data.quotes ?? [])
      .filter((x) => x.symbol && x.quoteType)
      .map((x) => ({
        symbol: x.symbol as string,
        name: x.longname || x.shortname || (x.symbol as string),
        type: x.quoteType as string,
        exchange: x.exchange ?? "",
      }))
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
