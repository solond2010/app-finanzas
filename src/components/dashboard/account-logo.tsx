"use client"

import { useState } from "react"
import { type Account } from "@/lib/store"
import { typeConfig } from "@/lib/account-types"

const BANK_LOGOS: { match: string; file: string }[] = [
  { match: "revolut", file: "revolut.png" },
  { match: "santander", file: "santander.png" },
  { match: "myinvestor", file: "myinvestor.png" },
  { match: "traderepublic", file: "trade-republic-seeklogo.png" },
]

function logoFor(banco: string | undefined): string | null {
  if (!banco) return null
  const slug = banco.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").replace(/[^a-z0-9]+/g, "")
  const hit = BANK_LOGOS.find((b) => slug.includes(b.match))
  return hit ? `/banks/${hit.file}` : null
}

export function AccountLogo({ account, className = "h-11 w-11" }: { account: Account; className?: string }) {
  const [failed, setFailed] = useState(false)
  const src = logoFor(account.banco)
  const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
  const Icon = cfg.icon

  if (src && !failed) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 ring-1 ring-black/10 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={account.banco} className="h-full w-full object-contain" onError={() => setFailed(true)} />
      </span>
    )
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl ${className}`}
      style={{ backgroundColor: `color-mix(in oklch, ${cfg.color} 14%, transparent)`, color: cfg.color }}
    >
      <Icon className="h-1/2 w-1/2" />
    </span>
  )
}
