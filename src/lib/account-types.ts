import type { Account } from "./store"
import { ShieldCheck, Wallet, TrendingUp, Landmark, CreditCard } from "lucide-react"
import type { ElementType } from "react"

export const typeConfig: Record<Account["tipo"], { label: string; icon: ElementType; color: string; tint: string }> = {
  emergencia: { label: "Emergencia", icon: ShieldCheck, color: "#10b981", tint: "from-emerald-500/16 to-emerald-500/[0.02]" },
  ahorro: { label: "Ahorro", icon: Wallet, color: "#3b82f6", tint: "from-blue-500/16 to-blue-500/[0.02]" },
  inversion: { label: "Inversión", icon: TrendingUp, color: "#8b5cf6", tint: "from-violet-500/16 to-violet-500/[0.02]" },
  efectivo: { label: "Efectivo", icon: Landmark, color: "#f59e0b", tint: "from-amber-500/16 to-amber-500/[0.02]" },
  gastos: { label: "Gastos", icon: CreditCard, color: "#ef4444", tint: "from-red-500/16 to-red-500/[0.02]" },
}

export const typeLabels: Record<string, string> = {
  emergencia: "Emergencia",
  ahorro: "Ahorro",
  inversion: "Inversión",
  efectivo: "Efectivo",
  gastos: "Gastos",
}
