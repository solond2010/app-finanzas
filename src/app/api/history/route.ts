import { NextResponse } from "next/server"

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

interface ChartResult {
  timestamp?: number[]
  indicators?: { quote?: { close?: (number | null)[] }[] }
}

const ALLOWED_INTERVAL = new Set(["1d", "1wk", "1mo"])
const ALLOWED_RANGE = new Set(["1mo", "3mo", "6mo", "1y", "2y", "5y", "max"])

async function fetchHistory(symbol: string, interval: string, range: string): Promise<{ t: number; c: number }[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
      { headers: { "User-Agent": UA }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data = (await res.json()) as { chart?: { result?: ChartResult[] } }
    const r = data.chart?.result?.[0]
    const ts = r?.timestamp ?? []
    const closes = r?.indicators?.quote?.[0]?.close ?? []
    const out: { t: number; c: number }[] = []
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i]
      if (typeof c === "number") out.push({ t: ts[i], c })
    }
    return out
  } catch {
    return []
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40)

  const intervalParam = searchParams.get("interval") ?? "1mo"
  const rangeParam = searchParams.get("range") ?? "1y"
  const interval = ALLOWED_INTERVAL.has(intervalParam) ? intervalParam : "1mo"
  const range = ALLOWED_RANGE.has(rangeParam) ? rangeParam : "1y"

  const entries = await Promise.all(symbols.map(async (s) => [s, await fetchHistory(s, interval, range)] as const))
  const history: Record<string, { t: number; c: number }[]> = {}
  for (const [s, h] of entries) history[s] = h
  return NextResponse.json({ history })
}
