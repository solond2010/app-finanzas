import type { Account } from "./store"
import { ShieldCheck, Wallet, Coins, Landmark, CreditCard } from "@/components/icons"
import type { ElementType } from "react"

export const typeConfig: Record<Account["tipo"], { label: string; icon: ElementType; color: string; tint: string }> = {
  emergencia: { label: "Emergencia", icon: ShieldCheck, color: "#2BD9A0", tint: "from-emerald-500/16 to-emerald-500/[0.02]" },
  ahorro: { label: "Ahorro", icon: Wallet, color: "#8B95A5", tint: "from-blue-500/16 to-blue-500/[0.02]" },
  inversion: { label: "Inversión", icon: Coins, color: "#F5A524", tint: "from-amber-500/16 to-amber-500/[0.02]" },
  efectivo: { label: "Efectivo", icon: Landmark, color: "#FFD08A", tint: "from-amber-500/10 to-amber-500/[0.02]" },
  gastos: { label: "Gastos", icon: CreditCard, color: "#FF6B5B", tint: "from-red-500/16 to-red-500/[0.02]" },
}

export const typeLabels: Record<string, string> = {
  emergencia: "Emergencia",
  ahorro: "Ahorro",
  inversion: "Inversión",
  efectivo: "Efectivo",
  gastos: "Gastos",
}
