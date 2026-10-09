"use client"

import { useEffect, useState, type ElementType } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, ChartPie, Ellipsis, Eye, EyeOff, House, Landmark, MoonStar, Plus, ReceiptText, SlidersHorizontal, SunMedium, X } from "lucide-react"
import { openMovementDialog } from "@/components/layout/quick-actions"
import { cn } from "@/lib/utils"
import { usePrivacy } from "@/lib/privacy"

const primaryItems = [
  { href: "/dashboard", label: "Inicio", icon: House },
  { href: "/transactions", label: "Movimientos", icon: ReceiptText },
  { href: "/cuentas", label: "Cuentas", icon: Landmark },
]

const moreItems = [
  { href: "/agenda", label: "Agenda", description: "Pagos e ingresos recurrentes", icon: CalendarDays },
  { href: "/analytics", label: "Analíticas", description: "Tu evolución financiera", icon: ChartPie },
  { href: "/configuracion", label: "Configuración", description: "Preferencias y datos", icon: SlidersHorizontal },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const { privacy, toggle: togglePrivacy } = usePrivacy()
  const moreActive = moreItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))

  const toggleTheme = () => {
    document.documentElement.classList.add("theme-transition")
    window.setTimeout(() => document.documentElement.classList.remove("theme-transition"), 250)
    const next = !document.documentElement.classList.contains("dark")
    document.documentElement.classList.toggle("dark", next)
    const value = next ? "dark" : "light"
    localStorage.setItem("app-finanzas-theme", value)
    document.cookie = `app-finanzas-theme=${value};path=/;max-age=31536000;samesite=lax`
  }

  useEffect(() => {
    if (!moreOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [moreOpen])

  return (
    <>
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-[59] bg-black/45 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <section
            id="mobile-more-menu"
            aria-labelledby="mobile-more-title"
            aria-label="Más secciones"
            className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-lg rounded-t-[28px] border border-border bg-card p-4 pb-5 shadow-2xl lg:hidden animate-in slide-in-from-bottom-4 duration-200"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <p className="page-section-label">Tu espacio</p>
                <h2 id="mobile-more-title" className="mt-1 text-lg font-semibold">Más secciones</h2>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Cerrar menú" className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95">
                <X className="size-4" />
              </button>
            </div>
            <nav className="space-y-1" aria-label="Secciones adicionales">
              {moreItems.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn("flex min-h-14 items-center gap-3 rounded-2xl px-3 transition-colors active:scale-[0.99]", active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/70")}
                  >
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-primary/10" : "bg-muted text-muted-foreground")}>
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.description}</span>
                    </span>
                    {active && <span className="size-2 rounded-full bg-primary" />}
                  </Link>
                )
              })}
            </nav>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <button type="button" onClick={togglePrivacy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]">
                {privacy ? <EyeOff className="size-4 text-primary" /> : <Eye className="size-4 text-muted-foreground" />}
                {privacy ? "Mostrar cifras" : "Ocultar cifras"}
              </button>
              <button type="button" onClick={toggleTheme} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]">
                <SunMedium className="hidden size-4 dark:block" />
                <MoonStar className="size-4 dark:hidden" />
                <span className="hidden dark:inline">Modo claro</span>
                <span className="dark:hidden">Modo oscuro</span>
              </button>
            </div>
          </section>
        </>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-2xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegación principal"
      >
        <div className="mx-auto grid h-[var(--bottom-nav-h)] max-w-lg grid-cols-5 items-center px-2 sm:px-5">
          {primaryItems.slice(0, 2).map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return <NavItem key={item.href} {...item} active={active} />
          })}
          <button
            type="button"
            onClick={() => openMovementDialog()}
            aria-label="Nuevo movimiento"
            className="mx-auto flex size-12 -translate-y-2 items-center justify-center rounded-2xl bg-[var(--gold)] text-[var(--gold-foreground)] shadow-lg shadow-[color-mix(in_oklch,var(--gold),transparent_68%)] transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Plus className="size-6" strokeWidth={2.2} />
          </button>
          <NavItem {...primaryItems[2]} active={pathname === "/cuentas" || pathname.startsWith("/cuentas/")} />
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="mobile-more-menu"
            onClick={() => setMoreOpen((open) => !open)}
            className={cn("flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors active:scale-95", moreActive || moreOpen ? "text-primary" : "text-muted-foreground")}
          >
            <span className={cn("relative flex size-8 items-center justify-center rounded-xl", (moreActive || moreOpen) && "bg-primary/10")}>
              <Ellipsis className="size-5" />
              {moreActive && <span className="absolute -top-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-[var(--gold)]" />}
            </span>
            <span className="text-[10px] font-medium leading-none">Más</span>
          </button>
        </div>
      </nav>
    </>
  )
}

function NavItem({ href, label, icon, active }: { href: string; label: string; icon: ElementType; active: boolean }) {
  const Icon = icon
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", active ? "text-primary" : "text-muted-foreground")}
    >
      <span className={cn("relative flex size-8 items-center justify-center rounded-xl", active && "bg-primary/10")}>
        <Icon className="size-5" />
        {active && <span className="absolute -top-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-[var(--gold)]" />}
      </span>
      <span className="max-w-full truncate px-0.5 text-[10px] font-medium leading-none">{label}</span>
    </Link>
  )
}
