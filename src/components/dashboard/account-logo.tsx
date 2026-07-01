"use client"

import { useState } from "react"
import { type Account } from "@/lib/store"
import { typeConfig } from "@/lib/account-types"

export interface Bank {
  name: string
  match: string
  file: string
}

export const BANKS: Bank[] = [
  { name: "Revolut", match: "revolut", file: "revolut.png" },
  { name: "Santander", match: "santander", file: "santander.png" },
  { name: "MyInvestor", match: "myinvestor", file: "myinvestor.png" },
  { name: "Trade Republic", match: "traderepublic", file: "trade-republic-seeklogo.png" },
]

export function matchBank(banco: string | undefined): Bank | null {
  if (!banco) return null
  const slug = banco.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").replace(/[^a-z0-9]+/g, "")
  return BANKS.find((b) => slug.includes(b.match)) ?? null
}

export function AccountLogo({ account, className = "h-11 w-11" }: { account: Account; className?: string }) {
  const [failed, setFailed] = useState(false)
  const bank = matchBank(account.banco)
  const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
  const Icon = cfg.icon

  // El logo del banco tiene prioridad; si no hay banco pero la cuenta es de
  // efectivo, usamos su imagen dedicada. En ambos casos, si la imagen falla,
  // caemos al icono del tipo.
  const logoSrc = bank ? `/banks/${bank.file}` : account.tipo === "efectivo" ? "/banks/efectivo.webp" : null
  const logoAlt = bank?.name ?? "Efectivo"

  if (logoSrc && !failed) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 ring-1 ring-black/10 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt={logoAlt} className="h-full w-full object-contain" onError={() => setFailed(true)} />
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
