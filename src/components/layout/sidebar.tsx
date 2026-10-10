"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSyncStatus } from "@/lib/store"
import { useInvestmentSyncStatus } from "@/lib/investments"
import { usePrivacy } from "@/lib/privacy"
import {
  House,
  ReceiptText,
  CalendarDays,
  SlidersHorizontal,
  ChartPie,
  Landmark,
  Cloud,
  CloudOff,
  Loader2,
  SunMedium,
  MoonStar,
  ChevronLeft,
  Eye,
  EyeOff,
  CircleDollarSign,
  Plus,
} from "lucide-react"
import { useEffect } from "react"
import { useSidebar } from "@/lib/sidebar"
import { openMovementDialog } from "@/components/layout/quick-actions"

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: House },
  { href: "/transactions", label: "Movimientos", icon: ReceiptText },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/cuentas", label: "Cuentas", icon: Landmark },
  { href: "/analytics", label: "Analíticas", icon: ChartPie },
  { href: "/configuracion", label: "Configuración", icon: SlidersHorizontal },
]

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group/tooltip relative">
      {children}
      <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 rounded-xl bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-lg opacity-0 -translate-x-1 group-hover/tooltip:opacity-100 group-hover/tooltip:translate-x-0 transition-all duration-200 whitespace-nowrap">
        {label}
      </span>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { status: syncStatus, retrySync, lastSyncedAt } = useSyncStatus()
  const { status: investmentSyncStatus, retrySync: retryInvestmentSync } = useInvestmentSyncStatus()
  const retryAllSync = () => { retrySync(); retryInvestmentSync() }
  const { privacy, toggle: togglePrivacy } = usePrivacy()
  const { open: sidebarOpen, toggle: toggleSidebar } = useSidebar()
  const lastSyncedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : null

  // El servidor ya renderiza la clase "dark" según la cookie, así que al montar
  // solo migramos a usuarios antiguos que solo tuvieran el tema en localStorage:
  // si falta la cookie, la reponemos desde localStorage y aplicamos la clase.
  // Nota: el icono/texto de tema se resuelven con CSS (`dark:`), no con estado
  // de React, para evitar un hydration mismatch entre servidor y cliente.
  useEffect(() => {
    const hasCookie = document.cookie.includes("app-finanzas-theme=")
    if (!hasCookie) {
      const stored = localStorage.getItem("app-finanzas-theme")
      if (stored) {
        const dark = stored === "dark"
        document.documentElement.classList.toggle("dark", dark)
        document.cookie = `app-finanzas-theme=${dark ? "dark" : "light"};path=/;max-age=31536000;samesite=lax`
      }
    }
  }, [])

  const toggleTheme = () => {
    // Calculamos el siguiente estado a partir de la clase REAL del DOM, no del
    // estado de React (que podría ir desfasado). Así el primer clic siempre
    // alterna el tema de forma fiable. Persistimos en cookie (para el SSR sin
    // flash) y en localStorage (compatibilidad).
    // "theme-transition" difumina el cambio de colores (ver globals.css) en vez
    // de un cambio brusco; se retira sola cuando termina la transición.
    document.documentElement.classList.add("theme-transition")
    window.setTimeout(() => document.documentElement.classList.remove("theme-transition"), 250)
    const next = !document.documentElement.classList.contains("dark")
    document.documentElement.classList.toggle("dark", next)
    const value = next ? "dark" : "light"
    localStorage.setItem("app-finanzas-theme", value)
    document.cookie = `app-finanzas-theme=${value};path=/;max-age=31536000;samesite=lax`
  }

  const syncMeta =
    syncStatus === "error" || investmentSyncStatus === "error"
      ? { label: `Error al guardar${lastSyncedLabel ? ` · último OK ${lastSyncedLabel}` : ""} · toca para reintentar`, icon: <CloudOff className="h-3.5 w-3.5" />, className: "text-red-500", retry: true }
      : syncStatus === "offline" || investmentSyncStatus === "offline"
        ? { label: `Sin conexión · se guardará al reconectar${lastSyncedLabel ? ` · último OK ${lastSyncedLabel}` : ""}`, icon: <CloudOff className="h-3.5 w-3.5" />, className: "text-muted-foreground", retry: true }
        : syncStatus === "syncing" || investmentSyncStatus === "syncing"
      ? { label: "Sincronizando...", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, className: "text-amber-500", retry: false }
      : syncStatus === "saved" || investmentSyncStatus === "saved"
        ? { label: lastSyncedLabel ? `Guardado en nube · ${lastSyncedLabel}` : "Guardado en nube", icon: <Cloud className="h-3.5 w-3.5" />, className: "text-emerald-500", retry: false }
        : { label: "Sin cambios pendientes", icon: <Cloud className="h-3.5 w-3.5" />, className: "text-muted-foreground", retry: false }

  return (
    <>
      {/* Desktop collapse toggle */}
      <button
        onClick={toggleSidebar}
        className={cn(
          "fixed top-[72px] z-50 hidden -translate-x-1/2 lg:flex items-center justify-center transition-all duration-300 active:scale-90 press-effect",
          sidebarOpen ? "left-52" : "left-16"
        )}
        style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        aria-label={sidebarOpen ? "Colapsar menú" : "Expandir menú"}
        aria-expanded={sidebarOpen}
        aria-controls="main-navigation-sidebar"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/60 shadow-md hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all">
          <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform duration-300", !sidebarOpen && "rotate-180")} />
        </span>
      </button>

      {/* Desktop icon-only bar (when collapsed) */}
      {!sidebarOpen && (
        <aside className="app-sidebar fixed left-0 top-0 z-40 hidden h-full w-16 flex-col items-center border-r bg-sidebar py-5 shadow-xl shadow-sidebar-border/50 lg:flex">
          <div className="mb-6">
            <div className="gold-badge flex size-9 items-center justify-center rounded-xl">
              <CircleDollarSign className="h-4 w-4" />
            </div>
          </div>
          <Tooltip label="Nuevo movimiento">
            <button
              type="button"
              onClick={() => openMovementDialog()}
              aria-label="Nuevo movimiento"
              className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-95"
            >
              <Plus className="h-4 w-4" />
            </button>
          </Tooltip>
          <nav className="flex flex-col gap-1 flex-1" aria-label="Navegación principal">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Tooltip key={item.href} label={item.label}>
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-center rounded-xl p-2.5 transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground/40 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground active:scale-95"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {isActive && <span className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />}
                  </Link>
                </Tooltip>
              )
            })}
          </nav>
          <div className="flex flex-col gap-1 mt-auto">
            <Tooltip label={privacy ? "Mostrar cifras" : "Ocultar cifras"}>
              <button
                onClick={togglePrivacy}
                aria-label={privacy ? "Mostrar cifras" : "Ocultar cifras"}
                className="flex items-center justify-center rounded-xl p-2.5 text-sidebar-foreground/40 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all active:scale-95"
              >
                {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Tooltip>
            <Tooltip label="Cambiar tema">
              <button
                onClick={toggleTheme}
                aria-label="Cambiar tema"
                className="flex items-center justify-center rounded-xl p-2.5 text-sidebar-foreground/40 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all active:scale-95"
              >
                <SunMedium className="hidden h-4 w-4 dark:block" />
                <MoonStar className="h-4 w-4 dark:hidden" />
              </button>
            </Tooltip>
            <Tooltip label={syncMeta.label}>
              {syncMeta.retry ? (
                <button
                  onClick={retryAllSync}
                  aria-label={syncMeta.label}
                  className="flex items-center justify-center rounded-xl p-2.5 transition-colors hover:bg-sidebar-accent/50"
                >
                  <span className={syncMeta.className}>{syncMeta.icon}</span>
                </button>
              ) : (
                <span className="flex items-center justify-center rounded-xl p-2.5">
                  <span className={syncMeta.className}>{syncMeta.icon}</span>
                </span>
              )}
            </Tooltip>
          </div>
        </aside>
      )}

      {/* Desktop full sidebar (when open) + mobile sidebar */}
      <aside
        id="main-navigation-sidebar"
        className={cn(
          "app-sidebar fixed left-0 top-0 z-40 hidden h-full w-52 flex-col border-r bg-sidebar py-6 shadow-xl shadow-sidebar-border/50 transition-all duration-300 ease-in-out lg:flex",
          sidebarOpen ? "lg:translate-x-0 lg:opacity-100" : "lg:-translate-x-full lg:opacity-0 lg:pointer-events-none"
        )}
      >
        <div className="flex items-center gap-3 mb-8 px-4">
          <div className="gold-badge flex size-9 items-center justify-center rounded-xl">
            <CircleDollarSign className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-sidebar-foreground">Finanzas</h1>
            <p className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">Panel de Control</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openMovementDialog()}
          className="mx-3 mb-4 hidden items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98] lg:flex"
        >
          <Plus className="h-4 w-4" />
          Nuevo movimiento
        </button>

        {/* Rutas principales: solo en desktop. En móvil la bottom nav ya las cubre. */}
        <nav className="hidden flex-col gap-0.5 flex-1 px-3 lg:flex" aria-label="Navegación principal">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground active:scale-[0.98]"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/40")} />
                {item.label}
                {isActive && <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />}
              </Link>
            )
          })}
        </nav>

        {/* Ajustes globales de escritorio; en móvil viven en el panel «Más». */}
        <div className="mt-auto space-y-1 px-3 pt-4 border-t border-sidebar-border/50">
          <button
            onClick={togglePrivacy}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors duration-150 active:scale-[0.98]"
            aria-label={privacy ? "Desactivar modo privacidad" : "Activar modo privacidad"}
          >
            <div className="flex size-4 items-center justify-center">
              {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </div>
            {privacy ? "Mostrar cifras" : "Ocultar cifras"}
          </button>
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors duration-150 active:scale-[0.98]"
            aria-label="Cambiar tema"
          >
            <div className="flex size-4 items-center justify-center">
              <SunMedium className="hidden h-4 w-4 dark:block" />
              <MoonStar className="h-4 w-4 dark:hidden" />
            </div>
            <span className="hidden dark:inline">Modo claro</span>
            <span className="dark:hidden">Modo oscuro</span>
          </button>
          {syncMeta.retry ? (
            <button
              onClick={retryAllSync}
              className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors hover:bg-sidebar-accent/50", syncMeta.className)}
            >
              {syncMeta.icon}
              <span className="text-left">{syncMeta.label}</span>
            </button>
          ) : (
            <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium", syncMeta.className)}>
              {syncMeta.icon}
              <span>{syncMeta.label}</span>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
