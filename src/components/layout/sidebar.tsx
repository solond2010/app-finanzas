"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useFinance } from "@/lib/store"
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Settings,
  BarChart3,
  Wallet,
  Cloud,
  CloudOff,
  Loader2,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transacciones", icon: ArrowLeftRight },
  { href: "/cuentas", label: "Cuentas", icon: Wallet },
  { href: "/analytics", label: "Analíticas", icon: BarChart3 },
  { href: "/objetivos", label: "Objetivos", icon: Target },
  { href: "/configuracion", label: "Configuración", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { syncStatus } = useFinance()

  const syncMeta =
    syncStatus === "syncing"
      ? { label: "Sincronizando nube...", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, className: "text-amber-500" }
      : syncStatus === "saved"
        ? { label: "Guardado en nube", icon: <Cloud className="h-3.5 w-3.5" />, className: "text-emerald-500" }
        : syncStatus === "error"
          ? { label: "Error al sincronizar", icon: <CloudOff className="h-3.5 w-3.5" />, className: "text-red-500" }
          : { label: "Sin cambios pendientes", icon: <Cloud className="h-3.5 w-3.5" />, className: "text-muted-foreground" }

  return (
    <aside className="fixed left-0 top-0 z-40 h-full w-64 border-r bg-sidebar p-6 flex flex-col">
      <div className="mb-8 px-2">
        <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground">
          Finanzas
        </h1>
        <p className="text-xs text-muted-foreground">Panel de Control</p>
      </div>

      <nav className="flex flex-col gap-1.5 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-4 rounded-lg border bg-sidebar-accent/30 px-3 py-2">
        <div className={cn("flex items-center gap-2 text-xs font-medium", syncMeta.className)}>
          {syncMeta.icon}
          <span>{syncMeta.label}</span>
        </div>
      </div>
    </aside>
  )
}
