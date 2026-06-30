import { NextResponse } from "next/server"

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

interface ChartMeta {
  regularMarketPrice?: number
  currency?: string
  shortName?: string
  longName?: string
  exchangeName?: string
  fullExchangeName?: string
  instrumentType?: string
  previousClose?: number
  chartPreviousClose?: number
  regularMarketDayHigh?: number
  regularMarketDayLow?: number
  regularMarketVolume?: number
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
}

interface SummaryNum { raw?: number }
interface QuoteSummaryResult {
  summaryDetail?: {
    marketCap?: SummaryNum
    trailingPE?: SummaryNum
    forwardPE?: SummaryNum
    dividendYield?: SummaryNum
    beta?: SummaryNum
    volume?: SummaryNum
    fiftyTwoWeekHigh?: SummaryNum
    fiftyTwoWeekLow?: SummaryNum
  }
  defaultKeyStatistics?: {
    trailingEps?: SummaryNum
    forwardEps?: SummaryNum
    beta?: SummaryNum
    priceToBook?: SummaryNum
  }
  price?: {
    marketCap?: SummaryNum
    longName?: string
    shortName?: string
    currency?: string
  }
}

interface AssetData {
  symbol: string
  name: string
  currency: string
  exchange: string
  type: string
  price: number
  changePct: number | null
  dayHigh: number | null
  dayLow: number | null
  volume: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  marketCap: number | null
  trailingPE: number | null
  forwardPE: number | null
  eps: number | null
  beta: number | null
  priceToBook: number | null
  dividendYield: number | null
}

async function fetchChart(symbol: string): Promise<ChartMeta | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: { "User-Agent": UA }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = (await res.json()) as { chart?: { result?: { meta?: ChartMeta }[] } }
    return data.chart?.result?.[0]?.meta ?? null
  } catch {
    return null
  }
}

// Best-effort: Yahoo quoteSummary requires a cookie + crumb. If it fails we
// degrade gracefully and the asset card just shows chart-derived data.
async function fetchSummary(symbol: string): Promise<QuoteSummaryResult | null> {
  try {
    const cookieRes = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA } })
    const setCookie = cookieRes.headers.get("set-cookie") ?? ""
    const cookie = setCookie.split(",").map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ")
    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, cookie },
    })
    const crumb = (await crumbRes.text()).trim()
    if (!crumb || crumb.includes("<")) return null
    const modules = "summaryDetail,defaultKeyStatistics,price"
    const res = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`,
      { headers: { "User-Agent": UA, cookie }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = (await res.json()) as { quoteSummary?: { result?: QuoteSummaryResult[] } }
    return data.quoteSummary?.result?.[0] ?? null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get("symbol")?.trim()
  if (!symbol) return NextResponse.json({ asset: null })

  const [meta, summary] = await Promise.all([fetchChart(symbol), fetchSummary(symbol)])
  if (!meta || typeof meta.regularMarketPrice !== "number") {
    return NextResponse.json({ asset: null })
  }

  const prev = typeof meta.previousClose === "number" ? meta.previousClose : meta.chartPreviousClose
  const changePct = typeof prev === "number" && prev !== 0 ? (meta.regularMarketPrice / prev - 1) * 100 : null
  const sd = summary?.summaryDetail
  const ks = summary?.defaultKeyStatistics

  const asset: AssetData = {
    symbol,
    name: summary?.price?.longName || summary?.price?.shortName || meta.longName || meta.shortName || symbol,
    currency: meta.currency || summary?.price?.currency || "USD",
    exchange: meta.fullExchangeName || meta.exchangeName || "",
    type: meta.instrumentType || "",
    price: meta.regularMarketPrice,
    changePct,
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    volume: meta.regularMarketVolume ?? sd?.volume?.raw ?? null,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? sd?.fiftyTwoWeekHigh?.raw ?? null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? sd?.fiftyTwoWeekLow?.raw ?? null,
    marketCap: sd?.marketCap?.raw ?? summary?.price?.marketCap?.raw ?? null,
    trailingPE: sd?.trailingPE?.raw ?? null,
    forwardPE: sd?.forwardPE?.raw ?? null,
    eps: ks?.trailingEps?.raw ?? ks?.forwardEps?.raw ?? null,
    beta: sd?.beta?.raw ?? ks?.beta?.raw ?? null,
    priceToBook: ks?.priceToBook?.raw ?? null,
    dividendYield: sd?.dividendYield?.raw ?? null,
  }

  return NextResponse.json({ asset })
}
