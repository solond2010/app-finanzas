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
  Menu,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"

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
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  )
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

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

  const sidebarContent = (
    <>
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
              onClick={() => setMobileOpen(false)}
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

      <div className="mt-4 space-y-2">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          <div className="flex size-5 items-center justify-center">
            {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
          </div>
          {isDark ? "Modo claro" : "Modo oscuro"}
        </button>
        <div className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium", syncMeta.className)}>
          {syncMeta.icon}
          <span>{syncMeta.label}</span>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile toggle */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b bg-background/80 px-4 py-2.5 backdrop-blur-xl lg:hidden">
        <h1 className="text-base font-bold tracking-tight">Finanzas</h1>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:scale-90"
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r bg-sidebar p-6 shadow-lg shadow-sidebar-border/5 transition-transform duration-300 ease-in-out",
          "max-lg:top-[var(--mobile-header-h)] max-lg:h-[calc(100vh-var(--mobile-header-h))] max-lg:shadow-2xl",
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
