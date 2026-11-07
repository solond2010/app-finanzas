"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

type CompanyLogoProps = {
  name: string
  symbol?: string | null
  crypto?: boolean
  accent?: string
  className?: string
}

// Yahoo Finance uses local-exchange symbols for some holdings. Resolve a few
// common European listings to their canonical ticker before asking the logo API.
const LOCAL_LISTING_TICKERS: Record<string, string> = {
  "NVD.DE": "NVDA",
  "FB2A.DE": "META",
  "ABEA.DE": "GOOGL",
  "ABEC.DE": "GOOG",
  "APC.DE": "AAPL",
  "MSF.DE": "MSFT",
  "AMZ.DE": "AMZN",
  "TL0.DE": "TSLA",
}

const COMPANY_TICKERS: Array<[RegExp, string]> = [
  [/\bnvidia\b/, "NVDA"],
  [/\bmeta(?: platforms)?\b|\bfacebook\b/, "META"],
  [/\balphabet\b|\bgoogle\b/, "GOOGL"],
  [/\bapple\b/, "AAPL"],
  [/\bmicrosoft\b/, "MSFT"],
  [/\bamazon\b/, "AMZN"],
  [/\btesla\b/, "TSLA"],
]

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function logoSource(name: string, rawSymbol: string, crypto: boolean) {
  const symbol = rawSymbol.trim().split(" · ")[0].toUpperCase()
  if (!symbol || symbol.startsWith("CUSTOM:") || /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(symbol)) return null

  if (crypto) {
    const ticker = /bitcoin/i.test(name) ? "BTC" : /ethereum/i.test(name) ? "ETH" : symbol.replace(/^CRYPTO:/, "")
    return `https://logoapi.sh/crypto/${encodeURIComponent(ticker)}.svg`
  }

  const normalizedName = normalize(name)
  const ticker = LOCAL_LISTING_TICKERS[symbol]
    ?? COMPANY_TICKERS.find(([pattern]) => pattern.test(normalizedName))?.[1]
    ?? symbol

  return `https://logoapi.sh/ticker/${encodeURIComponent(ticker)}.svg`
}

function monogram(name: string) {
  const clean = name.replace(/\b(incorporated|corporation|limited|ltd|inc|plc|class [a-z])\b/gi, " ").trim()
  const firstWord = clean.split(/\s+/).find(Boolean) ?? name
  return Array.from(firstWord).slice(0, 2).join("").toUpperCase() || "•"
}

/** The ticker is sent to LogoAPI.sh; balances and quantities stay in the app. */
export function CompanyLogo({ name, symbol, crypto = false, accent = "#A78BFA", className }: CompanyLogoProps) {
  const src = logoSource(name, symbol ?? "", crypto)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showLogo = !!src && failedSrc !== src

  return (
    <span
      role="img"
      aria-label={`${name} logo`}
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/10", className)}
      style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, var(--card))`, color: accent }}
    >
      <span aria-hidden="true" className="text-[10px] font-bold tracking-tight">{monogram(name)}</span>
      {showLogo && (
        // The external CDN owns sizing and cache headers; bypass Next's image proxy.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full bg-white object-contain p-1"
          onError={() => setFailedSrc(src)}
        />
      )}
    </span>
  )
}
