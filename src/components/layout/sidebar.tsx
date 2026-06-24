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
  SunMedium,
  MoonStar,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

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
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("app-finanzas-theme", next ? "dark" : "light")
    setIsDark(next)
  }

  const syncMeta =
    syncStatus === "syncing"
      ? { label: "Sincronizando nube...", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, className: "text-amber-500" }
      : syncStatus === "saved"
        ? { label: "Guardado en nube", icon: <Cloud className="h-3.5 w-3.5" />, className: "text-emerald-500" }
        : syncStatus === "error"
          ? { label: "Error al sincronizar", icon: <CloudOff className="h-3.5 w-3.5" />, className: "text-red-500" }
          : { label: "Sin cambios pendientes", icon: <Cloud className="h-3.5 w-3.5" />, className: "text-muted-foreground" }

  return (
    <aside className="fixed left-0 top-0 z-40 h-full w-64 border-r bg-sidebar p-6 flex flex-col shadow-lg shadow-sidebar-border/5">
      <div className="mb-8 px-2">
        <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground">
          Finanzas
        </h1>
        <p className="text-xs text-muted-foreground">Panel de Control</p>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground pl-10 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-1 before:rounded-full before:bg-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-4 space-y-3">
        <Button variant="outline" className="w-full justify-start gap-2 border-sidebar-border bg-sidebar/70 text-sidebar-foreground hover:bg-sidebar-accent/60" onClick={toggleTheme}>
          {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
          {isDark ? "Modo claro" : "Modo oscuro"}
        </Button>
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2">
          <div className={cn("flex items-center gap-2 text-xs font-medium", syncMeta.className)}>
            {syncMeta.icon}
            <span>{syncMeta.label}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
