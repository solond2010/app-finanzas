"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useFinance } from "@/lib/store"
import { usePrivacy } from "@/lib/privacy"
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
  ChevronLeft,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useSidebar } from "@/lib/sidebar"

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
  const { privacy, toggle: togglePrivacy } = usePrivacy()
  const { open: sidebarOpen, toggle: toggleSidebar } = useSidebar()
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
      ? { label: "Sincronizando...", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, className: "text-amber-500" }
      : syncStatus === "saved"
        ? { label: "Guardado en nube", icon: <Cloud className="h-3.5 w-3.5" />, className: "text-emerald-500" }
        : syncStatus === "error"
          ? { label: "Error de sincronización", icon: <CloudOff className="h-3.5 w-3.5" />, className: "text-red-500" }
          : { label: "Sin cambios pendientes", icon: <Cloud className="h-3.5 w-3.5" />, className: "text-muted-foreground" }

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b bg-background/80 px-3 py-2.5 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePrivacy}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:scale-90 touch-manipulation"
            aria-label={privacy ? "Desactivar modo privacidad" : "Activar modo privacidad"}
          >
            {privacy ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
          <h1 className="text-base font-bold tracking-tight">Finanzas</h1>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:scale-90 touch-manipulation"
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r bg-sidebar py-6 shadow-xl shadow-sidebar-border/50 transition-transform duration-300 ease-in-out",
          "max-lg:top-[var(--mobile-header-h)] max-lg:h-[calc(100vh-var(--mobile-header-h))] max-lg:shadow-2xl",
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          sidebarOpen ? "lg:translate-x-0" : "lg:-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between mb-8 px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-sidebar-foreground">Finanzas</h1>
              <p className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">Panel de Control</p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex items-center justify-center rounded-xl p-1.5 text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors active:scale-90"
            aria-label="Colapsar menú"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 flex-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/40")} />
                {item.label}
                {isActive && <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            )
          })}
        </nav>

        <div className="mt-4 space-y-1 px-3 pt-4 border-t border-sidebar-border/50">
          <button
            onClick={togglePrivacy}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            aria-label={privacy ? "Desactivar modo privacidad" : "Activar modo privacidad"}
          >
            <div className="flex size-4 items-center justify-center">
              {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </div>
            {privacy ? "Mostrar cifras" : "Ocultar cifras"}
          </button>
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            <div className="flex size-4 items-center justify-center">
              {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
            </div>
            {isDark ? "Modo claro" : "Modo oscuro"}
          </button>
          <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium", syncMeta.className)}>
            {syncMeta.icon}
            <span>{syncMeta.label}</span>
          </div>
        </div>
      </aside>
    </>
  )
}
