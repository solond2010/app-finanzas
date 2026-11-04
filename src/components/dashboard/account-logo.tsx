"use client"

import { useState } from "react"
import { type Account } from "@/lib/store"
import { typeConfig } from "@/lib/account-types"
import { accountColor } from "@/lib/account-colors"

export interface Bank {
  name: string
  match: string
  file: string
  /** Solo coincide si el nombre empieza así (para nombres cortos como ING). */
  prefix?: boolean
}

// Logos oficiales (favicon / icono de cada web), normalizados a 128×128.
// El orden importa: los nombres más específicos van antes.
export const BANKS: Bank[] = [
  { name: "Santander", match: "santander", file: "santander.png" },
  { name: "BBVA", match: "bbva", file: "bbva.webp" },
  { name: "CaixaBank", match: "caixabank", file: "caixabank.webp" },
  { name: "ING", match: "ing", file: "ing.webp", prefix: true },
  { name: "Sabadell", match: "sabadell", file: "sabadell.webp" },
  { name: "Revolut", match: "revolut", file: "revolut.png" },
  { name: "MyInvestor", match: "myinvestor", file: "myinvestor.png" },
  { name: "Trade Republic", match: "traderepublic", file: "trade-republic-seeklogo.png" },
  { name: "Bankinter", match: "bankinter", file: "bankinter.webp" },
  { name: "Openbank", match: "openbank", file: "openbank.webp" },
  { name: "Unicaja", match: "unicaja", file: "unicaja.webp" },
  { name: "Abanca", match: "abanca", file: "abanca.webp" },
  { name: "Kutxabank", match: "kutxabank", file: "kutxabank.webp" },
  { name: "Ibercaja", match: "ibercaja", file: "ibercaja.webp" },
  { name: "Cajamar", match: "cajamar", file: "cajamar.webp" },
  { name: "imagin", match: "imagin", file: "imagin.webp" },
  { name: "N26", match: "n26", file: "n26.webp" },
  { name: "Wise", match: "wise", file: "wise.webp" },
  { name: "PayPal", match: "paypal", file: "paypal.webp" },
  { name: "Indexa Capital", match: "indexa", file: "indexa.webp" },
  { name: "DEGIRO", match: "degiro", file: "degiro.webp" },
  { name: "Interactive Brokers", match: "interactivebrokers", file: "ibkr.webp" },
  { name: "eToro", match: "etoro", file: "etoro.webp" },
  { name: "Binance", match: "binance", file: "binance.webp" },
  { name: "Coinbase", match: "coinbase", file: "coinbase.webp" },
  { name: "Bit2Me", match: "bit2me", file: "bit2me.webp" },
]

export function bankSlug(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").replace(/[^a-z0-9]+/g, "")
}

export function matchBank(banco: string | undefined): Bank | null {
  if (!banco) return null
  const slug = bankSlug(banco)
  if (slug === "ibkr") return BANKS.find((b) => b.match === "interactivebrokers") ?? null
  return BANKS.find((b) => (b.prefix ? slug.startsWith(b.match) : slug.includes(b.match))) ?? null
}

const AVATAR_COLORS = ["#F5A524", "#2BD9A0", "#5B9BFF", "#B07CFF", "#FF6B5B", "#22C3E6", "#F27BB5"]

/** Avatar con la inicial para bancos sin logo conocido. */
export function BankInitial({ name, className = "h-11 w-11" }: { name: string; className?: string }) {
  const slug = bankSlug(name) || "x"
  let h = 0
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const color = AVATAR_COLORS[h % AVATAR_COLORS.length]
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl font-bold ${className}`}
      style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function AccountLogo({ account, className = "h-11 w-11" }: { account: Account; className?: string }) {
  const [failed, setFailed] = useState(false)
  const bank = matchBank(account.banco)
  const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
  const Icon = cfg.icon
  const tint = accountColor(account)

  // El logo subido por el usuario tiene prioridad sobre el de un banco
  // reconocido; si no hay banco pero la cuenta es de efectivo, usamos su
  // imagen dedicada. En todos los casos, si la imagen falla, caemos al icono
  // del tipo.
  const logoSrc = account.logoUrl || (bank ? `/banks/${bank.file}` : account.tipo === "efectivo" ? "/banks/efectivo.webp" : null)
  const logoAlt = bank?.name ?? account.banco ?? "Efectivo"

  if (logoSrc && !failed) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 ring-1 ring-black/10 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt={logoAlt} className="h-full w-full object-contain" onError={() => setFailed(true)} />
      </span>
    )
  }

  if (account.banco?.trim() && account.tipo !== "efectivo") return <BankInitial name={account.banco} className={className} />

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl ${className}`}
      style={{ backgroundColor: `color-mix(in oklab, ${tint} 16%, transparent)`, color: tint }}
    >
      <Icon className="h-1/2 w-1/2" />
    </span>
  )
}
