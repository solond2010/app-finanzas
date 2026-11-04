"use client"

import { useEffect, useMemo, useState } from "react"
import type { Position } from "./investments"
import type { Quote } from "./portfolio"

export function useQuotes(positions: Position[]) {
  const symbols = useMemo(() => [...new Set(positions.filter((p) => p.kind !== "custom").map((p) => p.symbol))].sort().join(","), [positions])
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!symbols) { queueMicrotask(() => setReady(true)); return }
    let alive = true
    fetch(`/api/quote?symbols=${encodeURIComponent(symbols)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { quotes?: Record<string, Quote> } | null) => { if (alive) { setQuotes(d?.quotes ?? {}); setReady(true) } })
      .catch(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [symbols])
  return { quotes, ready }
}
